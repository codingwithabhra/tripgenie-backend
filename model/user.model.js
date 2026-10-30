import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
    {
        googleId: {
            type: String,
        },

        name: {
            type: String,
            trim: true,
            required: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            required: function () {
                return this.authType === "email";
            },
        },

        authType: {
            type: String,
            enum: ["google", "email"],
            default: "email",
        },

    },
    {
        timestamps: true,
    }
);

const User = mongoose.model("User", UserSchema);

export default User;
