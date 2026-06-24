import { Glob } from "bun";
import { Resolver } from "../../lib/validation/resolver";
import { fromSchema } from "../../lib/schema/from-schema";

let registered = false;

export async function registerSpecRemotes() {
   if (registered) return;
   registered = true;

   const root = `${import.meta.dir}/remotes`;
   const glob = new Glob("**/*.json");

   for await (const file of glob.scan(root)) {
      const path = `${root}/${file}`;
      const raw = await Bun.file(path).json();
      const schema = fromSchema(raw);
      const uriPath = file.replace(/\.json$/, ".json");

      Resolver.registerRemote(`http://localhost:1234/${uriPath}`, schema);

      if (file === "draft2020-12/schema.json") {
         Resolver.registerRemote(
            "https://json-schema.org/draft/2020-12/schema",
            schema
         );
      }

      if (file.startsWith("draft2020-12/meta/")) {
         const metaName = file
            .slice("draft2020-12/meta/".length)
            .replace(/\.json$/, "");
         Resolver.registerRemote(
            `https://json-schema.org/draft/2020-12/meta/${metaName}`,
            schema
         );
      }
   }
}
