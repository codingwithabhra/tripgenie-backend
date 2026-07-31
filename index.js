import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from 'openai';
import { initialiseDatabase } from "./db/db.connect.js";
import { TravelPlan } from "./model/trip.model.js";


const app = express();

app.use(express.json());

const corsOption = {
    origin: ["http://localhost:5173", "https://travel-genie-phi.vercel.app/"],
    credentials: true,
    optionSuccessStatus: 200,
};

app.use(cors(corsOption));

if (!process.env.OPENROUTER_API_KEY) {
    console.error('Please set your OPENROUTER_API_KEY in your .env');
    process.exit(1);
};

// openrouter via openai sdk
const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY, // This is the default and can be omitted
});
const MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';


const SYSTEM_PROMPT = `
You are an AI assistant acting as a helpful travel agent.
Respond with JSON only. No prose, markkdown, or backticks.

Use exactly this schema and field names:
{
  "destination": "string - city, country",
  "bestTime": "string - month(s)/season with one sentence why.",
  "topAttractions": ["string", "string", "string"],
  "sampleItinerary": [
    {
      "day": number,
      "plan": "string"
    }
  ],
  "estimatedBudgetEuros": {"low": number, "mid": number, "high": number},
  "localTips": ["string", "string"]
}

Rules-
- Output valid JSON only, nothing else.
- Keep numbers unquoted.
- Generate EXACTLY the number of itinerary objects requested by the user.
- Number the itinerary days sequentially starting from 1.
- If the user requests 3 days, return 3 itinerary objects.
- If the user requests 5 days, return 5 itinerary objects.
- If unsure, use null or [] but keep the schema.
`;

function tryParseModelJSON(content) {
    if (!content || typeof content !== 'string') {
        return { ok: false, error: 'empty content' };
    }
    const raw = content.trim();
    // 1. direct parse
    try { return { ok: true, value: JSON.parse(raw) }; } catch { };

    // 2. fenced code block ```json...``` or ```...```
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch && fenceMatch[1]) {
        const inner = fenceMatch[1].trim();
        try { return { ok: true, value: JSON.parse(inner) }; } catch (e) { };
    };

    // 3. substring between first { and last }
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
        const sub = raw.slice(first, last + 1);
        try { return { ok: true, value: JSON.parse(sub) }; } catch { };
    }
    return { ok: false, error: 'unable to parse JSON from model content' };
}

// ---------------------------------------- START SERVER ----------------------------------------

const startServer = async () => {
    try {
        await initialiseDatabase();

        // ---------------------------------------- ROUTES ----------------------------------------

        app.get("/health", (req, res) => {
            res.json({ ok: true });
        })

        // demo 'GET Endpoint' that calls the model and returns the parsed json
        app.get("/api/travel-plan", async (req, res) => {

            const destination = (req.query.destination || 'Tokyo, Japan').toString();
            const [city, country] = destination.split(",").map(item => item.trim());

            const days = Number(req.query.days || 3);

            try {
                // STEP 1 : Check MongoDB first
                const existingPlan = await TravelPlan.findOne({
                    city,
                    country,
                    durationDays: days
                });

                if (existingPlan) {
                    console.log("Returning plan from MongoDB...");
                    return res.json({ cached: true, data: existingPlan });
                }

                // STEP 2 : No plan found
                // Call OpenRouter
                const userPrompt = `Create a short ${days}-day travel plan for ${city}, ${country} for a first-time visitor.`;

                const resp = await client.chat.completions.create(
                    {
                        model: MODEL,
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            { role: 'user', content: userPrompt },
                        ]
                    }
                );

                console.log("The Response : ", JSON.stringify(resp, null, 2));

                const content = resp.choices?.[0]?.message?.content || "";
                const parsed = tryParseModelJSON(content);

                if (parsed.ok) {
                    const travelPlan = new TravelPlan({
                        ...parsed.value,

                        city,
                        country,
                        durationDays: days
                    });

                    await travelPlan.save();

                    return res.json({ cached: false, data: travelPlan });
                } else {
                    return res.status(502).json({ error: "Model did not return valid json", raw: content });
                }

            } catch (error) {
                const message = error?.response?.data || error?.message || 'Unknown error';
                return res.status(500).json({ error: "Upstream error", details: message });
            }
        });

        // ---------------------------------------- SERVER ----------------------------------------

        const PORT = 3000;

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        })

    } catch (error) {
        console.error("Failed to start server:", error);
    }
};

startServer();