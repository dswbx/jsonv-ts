import { invariant } from "jsonv-ts";
import { McpError } from "../error";
import { McpServer } from "../server";

export type StdioTransportOptions = {
   stdin: NodeJS.ReadStream;
   stdout: NodeJS.WriteStream;
   stderr: NodeJS.WriteStream;
   raw?: unknown;
};

export function stdioTransport(server: McpServer, opts: StdioTransportOptions) {
   const stdin = opts.stdin;
   const stdout = opts.stdout;
   const stderr = opts.stderr;

   invariant(
      stdin && stdin.readable && typeof stdin.on === "function",
      "stdin is required"
   );
   invariant(
      stdout && stdout.writable && typeof stdout.write === "function",
      "stdout is required"
   );
   invariant(
      stderr && stderr.writable && typeof stderr.write === "function",
      "stderr is required"
   );

   server.onNotification((message) => {
      if (message.method === "notification/message") {
         stdout.write(JSON.stringify(message) + "\n");
      }
   });

   return new ReadBuffer(stdin, {
      onMessage: async (message) => {
         try {
            const response = await server.handle(message, opts.raw);
            if (typeof response === "object" && response !== null) {
               stdout.write(JSON.stringify(response) + "\n");
            }
         } catch (e) {
            if (e instanceof McpError) {
               stderr.write(JSON.stringify(e.toJSON()) + "\n");
            } else {
               stderr.write(JSON.stringify({ error: String(e) }) + "\n");
            }
         }
      },
      onError: async (error) => {
         stderr.write(JSON.stringify({ error: String(error) }) + "\n");
      },
   });
}

class ReadBuffer {
   private _buffer?: Buffer;

   constructor(
      public stdin: NodeJS.ReadStream,
      public opts?: {
         onMessage?: (message: any) => void | Promise<void>;
         onError?: (error: any) => void | Promise<void>;
      }
   ) {
      this.stdin.on("data", this.onData.bind(this));
      this.stdin.on("error", this.onError.bind(this));
   }

   onData(data: any) {
      this.append(data);
   }

   onError(error: any) {
      this.opts?.onError?.(error);
   }

   append(chunk: Buffer): void {
      this._buffer = this._buffer
         ? Buffer.concat([this._buffer, chunk])
         : chunk;
      while (true) {
         try {
            const message = this.readMessage();
            if (message === null) {
               break;
            }

            this.opts?.onMessage?.(message);
         } catch (error) {
            this.opts?.onError?.(error);
         }
      }
   }

   readMessage(): any | null {
      if (!this._buffer) {
         return null;
      }

      const index = this._buffer.indexOf("\n");
      if (index === -1) {
         return null;
      }

      const line = this._buffer.toString("utf8", 0, index).replace(/\r$/, "");
      this._buffer = this._buffer.subarray(index + 1);
      return JSON.parse(line);
   }

   [Symbol.dispose]() {
      this.stdin.off("data", this.onData);
      this.stdin.off("error", this.onError);
      this._buffer = undefined;
   }
}
