import crypto from "node:crypto";
export function buildKey(master){ return crypto.scryptSync(String(master || ""), "leveling-v12", 32); }
export function encryptSecret(text, master){
  if(!master) throw new Error("LEVELING_MASTER_KEY is required");
  const key=buildKey(master), iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm",key,iv);
  const data=Buffer.concat([cipher.update(String(text),"utf8"),cipher.final()]);
  return {iv:iv.toString("base64"),tag:cipher.getAuthTag().toString("base64"),data:data.toString("base64")};
}
export function decryptSecret(box,master){
  const decipher=crypto.createDecipheriv("aes-256-gcm",buildKey(master),Buffer.from(box.iv,"base64"));
  decipher.setAuthTag(Buffer.from(box.tag,"base64"));
  return Buffer.concat([decipher.update(Buffer.from(box.data,"base64")),decipher.final()]).toString("utf8");
}
