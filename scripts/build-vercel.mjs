// Build da Vercel: aplica as migrations só no deploy de produção.
// Preview/Development apontam para outros bancos (ou, pior, para o de produção): migrar a partir de
// uma branch de PR alteraria o schema real antes do merge. A política expand/contract vale igual
// (ver comentário no cloudbuild.yaml): migration retrocompatível com o código anterior.
import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.env.VERCEL_ENV === "production") {
  run("npx", ["prisma", "migrate", "deploy", "--schema=packages/prisma/schema.prisma"]);
} else {
  console.log(`[build-vercel] VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}: pulando prisma migrate deploy`);
}

run("npm", ["run", "build"]);
