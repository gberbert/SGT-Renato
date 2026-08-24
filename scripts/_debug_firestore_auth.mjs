import { GoogleAuth } from "google-auth-library";
import sa from "../Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json" assert { type: "json" };

const auth = new GoogleAuth({
  credentials: sa,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

const client = await auth.getClient();
const tokenResponse = await client.getAccessToken();

const token = tokenResponse?.token;
console.log("project_id:", sa.project_id);
console.log("client_email:", sa.client_email);
console.log("token_present:", Boolean(token));
if (token) console.log("token_prefix:", token.slice(0, 12) + "...");
