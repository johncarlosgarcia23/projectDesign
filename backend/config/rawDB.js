// config/rawDB.js
import mongoose from "mongoose";

export const connectRawDB = async () => {
  try {
    const uri = "mongodb+srv://johncarlosgarcia23_db_user:Vqri3H3IyvR3RVk1@projectdesigndatabase.5mqij0z.mongodb.net/microgridDB?retryWrites=true&w=majority&appName=ProjectDesignDatabase";
    const conn = await mongoose.createConnection(uri, {
      serverApi: { version: "1", strict: true, deprecationErrors: true },
    });
    console.log(`Raw data DB connected: ${conn.name}`);
    return conn;
  } catch (error) {
    console.error("Raw DB connection error:", error.message);
    throw error;
  }
};
