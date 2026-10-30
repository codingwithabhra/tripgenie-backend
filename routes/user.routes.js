import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";

import User from "../model/user.model.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        {
            userId: user._id,
            email: user.email,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
};

// Remove sensitive information from user response
const getUserData = (user) => {
    return {
        _id: user._id,
        name: user.name,
        email: user.email,
        authType: user.authType,
        createdAt: user.createdAt,
    };
};


// =====================================
// 1. EMAIL SIGNUP
// POST /auth/signup
// =====================================
router.post("/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required",
            });
        }

        if (password.length < 7 || password.length > 15) {
            return res.status(400).json({
                message: "Password must be between 7 and 15 characters",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check if user already exists
        const existingUser = await User.findOne({
            email: normalizedEmail,
        });

        if (existingUser) {
            return res.status(409).json({
                message: "Email already registered. Please login.",
            });
        }

        // Hash password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            email: normalizedEmail,
            password: hashedPassword,
            authType: "email",
        });

        await newUser.save();

        const token = generateToken(newUser);

        return res.status(201).json({
            message: "Signup successful",
            token,
            user: getUserData(newUser),
        });
    } catch (error) {
        console.error("Signup error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                message: "Email already registered",
            });
        }

        return res.status(500).json({
            message: "Server error during signup",
        });
    }
});


// =====================================
// 2. EMAIL LOGIN
// POST /auth/login
// =====================================
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail,
        });

        if (!existingUser) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        if (
            existingUser.authType !== "email" ||
            !existingUser.password
        ) {
            return res.status(401).json({
                message: "Please login using Google",
            });
        }

        // Compare entered password with hashed password
        const isPasswordCorrect = await bcrypt.compare(
            password,
            existingUser.password
        );

        if (!isPasswordCorrect) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const token = generateToken(existingUser);

        return res.status(200).json({
            message: "Login successful",
            token,
            user: getUserData(existingUser),
        });
    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            message: "Server error during login",
        });
    }
});


// =====================================
// 3. GOOGLE SIGNUP / LOGIN
// POST /auth/google
// =====================================
router.post("/google", async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({
                message: "Google credential is required",
            });
        }

        // Verify the Google ID token
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();

        if (!payload || !payload.email || !payload.sub) {
            return res.status(401).json({
                message: "Invalid Google account information",
            });
        }

        // Only accept verified Google email addresses
        if (!payload.email_verified) {
            return res.status(401).json({
                message: "Please use a verified Google email",
            });
        }

        const googleId = payload.sub;
        const email = payload.email.toLowerCase();

        // Check if this Google account already exists
        let existingUser = await User.findOne({ googleId });

        if (!existingUser) {
            // Check if the email belongs to another account
            const emailUser = await User.findOne({ email });

            if (emailUser) {
                return res.status(409).json({
                    message:
                        "This email already has an account. Please login using your existing method.",
                });
            }

            // Create a new Google user
            existingUser = new User({
                googleId,
                name: payload.name || "TravelGenie User",
                email,
                authType: "google",
            });

            await existingUser.save();
        }

        const token = generateToken(existingUser);

        return res.status(200).json({
            message: "Google login successful",
            token,
            user: getUserData(existingUser),
        });
    } catch (error) {
        console.error("Google authentication error:", error.message);

        return res.status(401).json({
            message: "Google authentication failed",
        });
    }
});


// =====================================
// 4. FETCH LOGGED-IN USER PROFILE
// GET /auth/profile
// =====================================
router.get("/profile", authMiddleware, async (req, res) => {
    try {
        // userId was added to the JWT when it was created
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        return res.status(200).json({
            message: "Profile fetched successfully",
            user: getUserData(user),
        });
    } catch (error) {
        console.error("Profile error:", error);

        return res.status(500).json({
            message: "Server error while fetching profile",
        });
    }
});

export default router;