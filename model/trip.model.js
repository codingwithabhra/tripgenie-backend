import mongoose from "mongoose";

const travelPlanSchema = new mongoose.Schema({

    // ---------- User Input ----------
    city: {
        type: String,
        required: true,
        trim: true,
    },

    country: {
        type: String,
        required: true,
        trim: true,
    },

    durationDays: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },

    // ---------- AI Output ----------
    destination: {
        type: String,
        required: true,
    },

    bestTime: {
        type: String,
        required: true,
    },

    topAttractions: {
        type: [String],
        default: [],
    },

    sampleItinerary: [
        {
            day: {
                type: Number,
                required: true,
            },
            plan: {
                type: String,
                required: true,
            },
        },
    ],

    estimatedBudgetEuros: {
        low: {
            type: Number,
            default: 0,
        },
        mid: {
            type: Number,
            default: 0,
        },
        high: {
            type: Number,
            default: 0,
        },
    },

    localTips: {
        type: [String],
        default: [],
    },

    // Cache indicator
    generatedByAI: {
        type: Boolean,
        default: true,
    },
},
    {
        timestamps: true,
    });

export const TravelPlan = mongoose.model("TravelPlan", travelPlanSchema);