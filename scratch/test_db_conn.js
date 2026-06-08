import { createClient } from '@libsql/client';

const token = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODA5MzE5MjQsImlkIjoiMDE5ZWE3ZDAtMjkwMS03OWIyLWI1YmMtOGI2OWU3MzM3ZWEwIiwicmlkIjoiMzI3NzUwODItMmQ0Ni00ZTU4LWI5OTMtNmMyYWVmNzMxNWM1In0.YOwukQ2x52GjwU3DOkjy4R-wslZOoFBsb_76jn-f_QLup1Clxxy7_MWz8ESBwRFtr6PvGUU6Ade8hlmoJqR3AQ";
const url = "libsql://hyvspecs-ishyv.aws-us-east-1.turso.io";

console.log("Connecting to:", url);
const client = createClient({ url, authToken: token });

try {
  const result = await client.execute("SELECT 1");
  console.log("Success! Result:", result);
} catch (e) {
  console.error("Failed to connect:", e);
}
