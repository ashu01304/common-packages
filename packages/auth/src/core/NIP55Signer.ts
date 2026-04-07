import { EventTemplate, getEventHash, Event, nip19 } from "nostr-tools";
import { NostrSigner } from "./types";
import { NostrSignerPlugin } from "nostr-signer-capacitor-plugin";
import { NPub } from "nostr-tools/nip19";

export function createNIP55Signer(
  packageName: string,
  initialPubkey?: string,
): NostrSigner {
  let cachedPubkey: string | undefined = initialPubkey;
  let packageNameSet = false;

  const ensurePackageNameSet = async () => {
    if (!packageNameSet) {
      await NostrSignerPlugin.setPackageName(packageName);
      packageNameSet = true;
    }
  };

  return {
    async getPublicKey(): Promise<string> {
      if (cachedPubkey) {
        await ensurePackageNameSet();
        return cachedPubkey;
      }

      await ensurePackageNameSet();

      const { npub } = await NostrSignerPlugin.getPublicKey();
      cachedPubkey = nip19.decode(npub as NPub).data as string;
      return cachedPubkey;
    },

    async signEvent(event: EventTemplate): Promise<Event> {
      const pubkey = await this.getPublicKey();

      const fullEvent = { ...event, pubkey };
      const id = getEventHash(fullEvent);
      const eventWithId = { ...fullEvent, id };

      const { event: signedEventJson } = await NostrSignerPlugin.signEvent(
        packageName,
        JSON.stringify(eventWithId),
        eventWithId.id,
        pubkey,
      );

      if (!signedEventJson) {
        throw new Error("Signer did not return a signed event");
      }

      return JSON.parse(signedEventJson) as Event;
    },

    async encrypt(pubkey: string, plaintext: string): Promise<string> {
      const currentPubkey = await this.getPublicKey();

      const { result } = await NostrSignerPlugin.nip04Encrypt(
        packageName,
        plaintext,
        "",
        pubkey,
        currentPubkey,
      );

      if (!result) throw new Error("NIP-04 encryption failed");

      return result;
    },

    async decrypt(pubkey: string, ciphertext: string): Promise<string> {
      const currentPubkey = await this.getPublicKey();

      const { result } = await NostrSignerPlugin.nip04Decrypt(
        packageName,
        ciphertext,
        "",
        pubkey,
        currentPubkey,
      );

      if (!result) throw new Error("NIP-04 decryption failed");

      return result;
    },

    async nip44Encrypt(pubkey: string, plaintext: string): Promise<string> {
      const currentPubkey = await this.getPublicKey();

      const { result } = await NostrSignerPlugin.nip44Encrypt(
        packageName,
        plaintext,
        "",
        pubkey,
        currentPubkey,
      );

      if (!result) throw new Error("NIP-44 encryption failed");

      return result;
    },

    async nip44Decrypt(pubkey: string, ciphertext: string): Promise<string> {
      const currentPubkey = await this.getPublicKey();

      const { result } = await NostrSignerPlugin.nip44Decrypt(
        packageName,
        ciphertext,
        "",
        pubkey,
        currentPubkey,
      );

      if (!result) throw new Error("NIP-44 decryption failed");

      return result;
    },
  };
}
