import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as unknown as {
  _mongo?: { client: MongoClient; db: Db; uri: string };
};

export async function getDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return null;
  }
  if (globalForMongo._mongo?.uri === uri) {
    return globalForMongo._mongo.db;
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  globalForMongo._mongo = { client, db, uri };
  return db;
}

export async function getMongoClient(): Promise<MongoClient | null> {
  await getDb();
  return globalForMongo._mongo?.client ?? null;
}
