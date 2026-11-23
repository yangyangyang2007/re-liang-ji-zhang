// Host-only helpers for 热量记账.
//
// compressMealPhoto re-encodes an uploaded meal photo to a ≤768px JPEG
// with Bun.Image (a native host capability, so it cannot live in the
// portable action bundle). Oversize PNG screenshots are what made vision
// inference fail with "Unsupported image"; shrinking/re-encoding here —
// before the bytes reach ctx.inference — is the fix. A failure returns
// ok:false so the action can stop with an honest error instead of
// forwarding the original oversize bytes.

import {
  definePrivilegedContracts,
  definePrivilegedHandlers,
  z,
} from "@hatch/space-sdk";

export const privileged = definePrivilegedContracts({
  compressMealPhoto: {
    request: z.object({ imageBase64: z.string().min(1) }),
    response: z.object({
      ok: z.boolean(),
      jpegBase64: z.string().nullable(),
    }),
    timeoutMs: 60_000,
  },
});

export const privilegedHandlers = definePrivilegedHandlers(privileged, {
  async compressMealPhoto(args) {
    try {
      const raw = Buffer.from(args.imageBase64, "base64");
      const out = await new Bun.Image(raw)
        .resize(768, 768, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .buffer();
      return { ok: true, jpegBase64: Buffer.from(out).toString("base64") };
    } catch {
      return { ok: false, jpegBase64: null };
    }
  },
});
