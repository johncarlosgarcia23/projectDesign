import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const uri = "mongodb+srv://johncarlosgarcia23_db_user:Vqri3H3IyvR3RVk1@projectdesigndatabase.5mqij0z.mongodb.net/microgridDB?retryWrites=true&w=majority&appName=ProjectDesignDatabase";
    const conn = await mongoose.connect(uri, {
      serverApi: { version: "1", strict: true, deprecationErrors: true },
    });
    console.log(`MongoDB connected: ${conn.connection.name}`);
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};
