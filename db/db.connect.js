import mongoose from "mongoose";
import 'dotenv/config';

const mongoUri = process.env.MONGODB;

export const initialiseDatabase = async() => {
    await mongoose.connect(mongoUri).then(() => {
        console.log('MongoDB connected successfully');
    }).catch((error) => {
        console.error("Failed to connect to database", error);
    })
};