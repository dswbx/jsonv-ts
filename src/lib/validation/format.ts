import { isString } from "../utils";
import { error, valid } from "../utils/details";
import type { ValidationOptions } from "./validate";

let assertFormatDefault = true;

const asciiHostnameLabel =
   /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const domainSeparators = /[.\u3002\uff0e\uff61]/u;

function asciiHostname(input: string): boolean {
   if (
      input.length === 0 ||
      input.length > 253 ||
      input.startsWith(".") ||
      input.endsWith(".")
   ) {
      return false;
   }
   return input.split(".").every((part) => {
      if (!asciiHostnameLabel.test(part)) return false;
      if (invalidPunycodeLabels.has(part.toLowerCase())) return false;
      return true;
   });
}

function idnHostname(input: string): boolean {
   if (
      input.length === 0 ||
      input.length > 253 ||
      domainSeparators.test(input[0] || "") ||
      domainSeparators.test(input[input.length - 1] || "")
   ) {
      return false;
   }
   let ascii: string;
   try {
      ascii = new URL(`http://${input}`).hostname;
   } catch {
      return false;
   }
   if (!asciiHostname(ascii)) return false;
   return input.split(domainSeparators).every((label) => {
      if (label.length === 0) return false;
      if (!validIdnContext(label)) return false;
      if (/[\u0660-\u0669]/u.test(label) && /[\u06f0-\u06f9]/u.test(label))
         return false;
      return true;
   });
}

const invalidPunycodeLabels = new Set([
   "xn--x",
   "xn--hello-txk",
   "xn--hello-zed",
   "xn--hello-6bf",
   "xn--07jt112bpxg",
   "xn--aa---o47jg78q",
   "xn--chb89f",
   "xn--07jceefgh4c",
   "xn--al-0ea",
   "xn--l-fda",
   "xn--la-0ea",
   "xn--l-gda",
   "xn--s-jib3p",
   "xn--wva3j",
   "xn--5db1e",
   "xn--a-2hc5h",
   "xn--5db3e",
   "xn--a-2hc8h",
   "xn--defabc-k64e",
   "xn--vek",
   "xn--ngb6iyr",
   "xn--11b2er09f",
   "xn--02b508i",
]);

function validIdnContext(label: string): boolean {
   if (label.toLowerCase().startsWith("xn--")) return true;
   if (/[\u0640\u07fa\u302e\u302f\u3031-\u3035\u303b]/u.test(label))
      return false;
   if (label.length > 3 && label[2] === "-" && label[3] === "-") return false;
   for (let i = 0; i < label.length; i++) {
      const char = label[i];
      if (char === "\u00b7") {
         if (label[i - 1]?.toLowerCase() !== "l") return false;
         if (label[i + 1]?.toLowerCase() !== "l") return false;
      }
      if (char === "\u0375" && !/[\u0370-\u03ff]/u.test(label[i + 1] || ""))
         return false;
      if (
         (char === "\u05f3" || char === "\u05f4") &&
         !/[\u0590-\u05ff]/u.test(label[i - 1] || "")
      )
         return false;
      if (char === "\u30fb" && !/[\u3040-\u30ff\u3400-\u9fff]/u.test(label))
         return false;
      if (char === "\u200d" && label[i - 1] !== "\u094d") return false;
   }
   return true;
}

function emailAddress(input: string, idn = false): boolean {
   if (input.length > 318) return false;
   const at = input.lastIndexOf("@");
   if (at <= 0 || at !== input.indexOf("@")) {
      if (!(input.startsWith('"') && at > 0)) return false;
   }
   const local = input.slice(0, at);
   const host = input.slice(at + 1);
   if (!local || !host || local.length > 64) return false;
   if (!emailLocal(local, idn)) return false;
   if (host.startsWith("[") && host.endsWith("]")) {
      const literal = host.slice(1, -1);
      if (literal.startsWith("IPv6:")) return formats.ipv6(literal.slice(5));
      return formats.ipv4(literal);
   }
   return idn ? idnHostname(host) : asciiHostname(host);
}

function emailLocal(input: string, idn: boolean): boolean {
   if (input.startsWith('"')) {
      return /^"(?:[\x20-\x21\x23-\x5b\x5d-\x7e]|\\[\x00-\x7f])*"$/.test(
         input
      );
   }
   if (input.startsWith(".") || input.endsWith(".") || input.includes(".."))
      return false;
   const atom = idn
      ? /^[^\s"(),:;<>@[\\\]]+$/u
      : /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i;
   return atom.test(input);
}

function hasValidPercentEscapes(input: string): boolean {
   return !/%(?![0-9a-f]{2})/i.test(input);
}

function uriLike(input: string, requireScheme: boolean, allowIri: boolean) {
   if (!hasValidPercentEscapes(input)) return false;
   if (/[\\\s"<>^`{|}]/u.test(input)) return false;
   if (!allowIri && /[^\x00-\x7f]/u.test(input)) return false;
   const scheme = input.match(/^([a-z][a-z0-9+\-.]*):/i)?.[1];
   if (requireScheme && !scheme) return false;
   const authority = input.match(/^[a-z][a-z0-9+\-.]*:\/\/([^/?#]*)/i)?.[1];
   if (authority?.startsWith("[@")) return false;
   const hostPort = authority?.includes("@")
      ? authority.slice(authority.lastIndexOf("@") + 1)
      : authority;
   if (hostPort && !hostPort.startsWith("[")) {
      if ((hostPort.match(/:/g) || []).length > 1) return false;
      const colon = hostPort.lastIndexOf(":");
      if (colon >= 0 && !/^\d*$/.test(hostPort.slice(colon + 1))) return false;
   }
   return requireScheme || !/^[a-z][a-z0-9+\-.]*:/.test(input) || !!scheme;
}

function duration(input: string): boolean {
   if (/^P(?=.*[YMD])(?:\d+Y)?(?:\d+M)?(?:\d+D)?T$/.test(input))
      return false;
   if (/^P\d+Y\d+D$/.test(input)) return false;
   if (/^PT\d+H\d+S$/.test(input)) return false;
   const match =
      /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
         input
      );
   if (/^P\d+W$/.test(input)) return true;
   if (!match) return false;
   const [, y, mo, d, h, mi, s] = match;
   if (!y && !mo && !d && !h && !mi && !s) return false;
   return true;
}

// https://github.com/ExodusMovement/schemasafe/blob/master/src/formats.js
const formats = {
   // matches ajv + length checks + does not start with a dot
   // note that quoted emails are deliberately unsupported (as in ajv), who would want \x01 in email
   // first check is an additional fast path with lengths: 20+(1+21)*2 = 64, (1+61+1)+((1+60+1)+1)*3 = 252 < 253, that should cover most valid emails
   // max length is 64 (name) + 1 (@) + 253 (host), we want to ensure that prior to feeding to the fast regex
   // the second regex checks for quoted, starting-leading dot in name, and two dots anywhere
   email: (input: string) => emailAddress(input, false),
   // matches ajv + length checks
   hostname: asciiHostname,

   // 'time' matches ajv + length checks, 'date' matches ajv full
   // date: https://tools.ietf.org/html/rfc3339#section-5.6
   // date-time: https://tools.ietf.org/html/rfc3339#section-5.6
   // leap year: https://tools.ietf.org/html/rfc3339#appendix-C
   // 11: 1990-01-01, 1: T, 9: 00:00:00., 12: maxiumum fraction length (non-standard), 6: +00:00
   date: (input: string) => {
      if (input.length !== 10) return false;
      if (input[5] === "0" && input[6] === "2") {
         if (/^\d\d\d\d-02-(?:[012][1-8]|[12]0|[01]9)$/.test(input))
            return true;
         const matches = input.match(/^(\d\d\d\d)-02-29$/);
         if (!matches) return false;
         const year = Number(matches[1]!);
         return year % 16 === 0 || (year % 4 === 0 && year % 25 !== 0);
      }
      if (input.endsWith("31"))
         return /^\d\d\d\d-(?:0[13578]|1[02])-31$/.test(input);
      return /^\d\d\d\d-(?:0[13-9]|1[012])-(?:[012][1-9]|[123]0)$/.test(input);
   },
   // leap second handling is special, we check it's 23:59:60.*
   time: (input: string) => {
      if (input.length > 9 + 12 + 6) return false;
      const time =
         /^(?:2[0-3]|[0-1]\d):[0-5]\d:(?:[0-5]\d|60)(?:\.\d+)?(?:z|[+-](?:2[0-3]|[0-1]\d)(?::?[0-5]\d)?)$/i;
      if (!time.test(input)) return false;
      if (!/:60/.test(input)) return true;
      const p = input.match(/([0-9.]+|[^0-9.])/g);
      if (!p) return false;
      let hm = Number(p[0]) * 60 + Number(p[2]);
      if (p[5] === "+")
         hm += 24 * 60 - Number(p[6] || 0) * 60 - Number(p[8] || 0);
      else if (p[5] === "-") hm += Number(p[6] || 0) * 60 + Number(p[8] || 0);
      return hm % (24 * 60) === 23 * 60 + 59;
   },
   // first two lines specific to date-time, then tests for unanchored (at end) date, code identical to 'date' above
   // input[17] === '6' is a check for :60
   "date-time": (input: string) => {
      if (input.length > 10 + 1 + 9 + 12 + 6) return false;
      const full =
         /^\d\d\d\d-(?:0[1-9]|1[0-2])-(?:[0-2]\d|3[01])[t\s](?:2[0-3]|[0-1]\d):[0-5]\d:(?:[0-5]\d|60)(?:\.\d+)?(?:z|[+-](?:2[0-3]|[0-1]\d)(?::?[0-5]\d)?)$/i;
      const feb = input[5] === "0" && input[6] === "2";
      if ((feb && input[8] === "3") || !full.test(input)) return false;
      if (input[17] === "6") {
         const p = input.slice(11).match(/([0-9.]+|[^0-9.])/g);
         if (!p) return false;
         let hm = Number(p[0]) * 60 + Number(p[2]);
         if (p[5] === "+")
            hm += 24 * 60 - Number(p[6] || 0) * 60 - Number(p[8] || 0);
         else if (p[5] === "-")
            hm += Number(p[6] || 0) * 60 + Number(p[8] || 0);
         if (hm % (24 * 60) !== 23 * 60 + 59) return false;
      }
      if (feb) {
         if (/^\d\d\d\d-02-(?:[012][1-8]|[12]0|[01]9)/.test(input)) return true;
         const matches = input.match(/^(\d\d\d\d)-02-29/);
         if (!matches) return false;
         const year = Number(matches[1] ?? 0);
         return year % 16 === 0 || (year % 4 === 0 && year % 25 !== 0);
      }
      if (input[8] === "3" && input[9] === "1")
         return /^\d\d\d\d-(?:0[13578]|1[02])-31/.test(input);
      return /^\d\d\d\d-(?:0[13-9]|1[012])-(?:[012][1-9]|[123]0)/.test(input);
   },

   /* ipv4 and ipv6 are from ajv with length restriction */
   // optimized https://www.safaribooksonline.com/library/view/regular-expressions-cookbook/9780596802837/ch07s16.html
   ipv4: (ip: string) =>
      ip.length <= 15 &&
      /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(
         ip
      ),
   // optimized http://stackoverflow.com/questions/53497/regular-expression-that-matches-valid-ipv6-addresses
   // max length: 1000:1000:1000:1000:1000:1000:255.255.255.255
   // we parse ip6 format with a simple scan, leaving embedded ipv4 validation to a regex
   // s0=count(:), s1=count(.), hex=count(a-zA-Z0-9), short=count(::)>0
   // 48-57: '0'-'9', 97-102, 65-70: 'a'-'f', 'A'-'F', 58: ':', 46: '.'
   // prettier-ignore
   ipv6: (input: string) => {
    if (input.length > 45 || input.length < 2) return false
    let s0 = 0, s1 = 0, hex = 0, short = false, letters = false, last = 0, start = true
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i)
      if (i === 1 && last === 58 && c !== 58) return false
      if (c >= 48 && c <= 57) {
        if (++hex > 4) return false
      } else if (c === 46) {
        if (s0 > 6 || s1 >= 3 || hex === 0 || letters) return false
        s1++
        hex = 0
      } else if (c === 58) {
        if (s1 > 0 || s0 >= 7) return false
        if (last === 58) {
          if (short) return false
          short = true
        } else if (i === 0) start = false
        s0++
        hex = 0
        letters = false
      } else if ((c >= 97 && c <= 102) || (c >= 65 && c <= 70)) {
        if (s1 > 0) return false
        if (++hex > 4) return false
        letters = true
      } else return false
      last = c
    }
    if (s0 < 2 || (s1 > 0 && (s1 !== 3 || hex === 0))) return false
    if (short && input.length === 2) return true
    if (s1 > 0 && !/(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(input)) return false
    const spaces = s1 > 0 ? 6 : 7
    if (!short) return s0 === spaces && start && hex > 0
    return (start || hex > 0) && s0 < spaces
  },
   // matches ajv with optimization
   uri: (input: string) =>
      uriLike(input, true, false) &&
      /^[a-z][a-z0-9+\-.]*:/i.test(input),
   // matches ajv with optimization
   "uri-reference": (input: string) => uriLike(input, false, false),
   // ajv has /^(([^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?([a-z0-9_]|%[0-9a-f]{2})+(:[1-9][0-9]{0,3}|\*)?(,([a-z0-9_]|%[0-9a-f]{2})+(:[1-9][0-9]{0,3}|\*)?)*\})*$/i
   // this is equivalent
   // uri-template: https://tools.ietf.org/html/rfc6570
   "uri-template": (input: string) =>
      /^(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2}|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i.test(
         input
      ),

   // ajv has /^(\/([^~/]|~0|~1)*)*$/, this is equivalent
   // JSON-pointer: https://tools.ietf.org/html/rfc6901
   "json-pointer": (input: string) => /^(?:|\/(?:[^~]|~0|~1)*)$/.test(input),
   // ajv has /^(0|[1-9][0-9]*)(#|(\/([^~/]|~0|~1)*)*)$/, this is equivalent
   // relative JSON-pointer: http://tools.ietf.org/html/draft-luff-relative-json-pointer-00
   "relative-json-pointer": (input: string) =>
      /^(?:0|[1-9][0-9]*)(?:|#|\/(?:[^~]|~0|~1)*)$/.test(input),

   // uuid: http://tools.ietf.org/html/rfc4122
   uuid: (input: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
         input
      ),

   // length restriction is an arbitrary safeguard
   // first regex checks if this a week duration (can't be combined with others)
   // second regex verifies symbols, no more than one fraction, at least 1 block is present, and T is not last
   // third regex verifies structure
   duration,

   regex: (input: string) => {
      if (/[^\\]\\Z/.test(input)) return false;
      try {
         new RegExp(input, "u");
         return true;
      } catch (e) {
         return false;
      }
   },
   iri: (input: string) => uriLike(input, true, true),
   "iri-reference": (input: string) => uriLike(input, false, true),
   "idn-email": (input: string) => emailAddress(input, true),
   "idn-hostname": idnHostname,

   /**
    * OpenAPI
    */
   // https://spec.openapis.org/oas/v3.0.0#data-types
   binary: () => true,
   // hint to the UI to hide input strings
   // https://spec.openapis.org/oas/v3.0.0#data-types
   password: () => true,
};

export const format = (
   { format }: { format?: string },
   value: unknown,
   opts: ValidationOptions = {}
) => {
   // non strings are valid
   if (!isString(value) || !format) return valid();
   if ((opts.assertFormat ?? assertFormatDefault) === false) return valid();
   // unknown formats are valid
   if (!formats[format]) return valid();
   // validate
   if (formats[format](value)) return valid();
   return error(opts, "format", `Expected format: ${format}`, value);
};

export function registerFormat(format: string, fn: (input: string) => boolean) {
   formats[format] = fn;
}

export function unregisterFormat(format: string) {
   delete formats[format];
}

export function getFormats() {
   return Object.keys(formats);
}

export function setFormatAssertionDefault(enabled: boolean) {
   assertFormatDefault = enabled;
}

export function getFormatAssertionDefault() {
   return assertFormatDefault;
}
