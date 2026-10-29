import { getStore } from "@netlify/blobs";
import { Store, blobsBackend, handle } from "../../src/sklad.mjs";

export default async (req) => {
  const store = new Store(blobsBackend(getStore({ name: "sklad", consistency: "strong" })));
  return handle(req, store);
};

export const config = { path: "/api/*" };
