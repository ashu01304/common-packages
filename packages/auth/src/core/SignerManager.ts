import { nip19 } from "nostr-tools";
import { bytesToHex } from "nostr-tools/utils";

import { nip07Signer } from "./NIP07Signer";
import { createNip46Signer } from "./NIP46Signer";
import { createLocalSigner } from "./LocalSigner";
import { createNIP55Signer } from "./NIP55Signer";
import { DeferredSigner } from "./DeferredSigner";
import { NostrSigner, IUser } from "./types";
import {
  getBunkerUriInLocalStorage,
  getKeysFromLocalStorage,
  setBunkerUriInLocalStorage,
  setKeysInLocalStorage,
  getUserDataFromLocalStorage,
  setUserDataInLocalStorage,
  clearAuthStorage,
} from "./utils";
import { fetchUserProfile } from "../utils/nostr";
import { isNative } from "../utils/platform";

const ANONYMOUS_USER_NAME = "Formstr User";
const DEFAULT_IMAGE_URL = "";

export class SignerManager {
  private signer: NostrSigner | null = null;
  private user: IUser | null = null;
  private onChangeCallbacks: Set<() => void> = new Set();
  private initialized = false;

  constructor() {}

  /**
   * Initializes the manager by restoring any existing session from storage.
   */
  async init() {
    if (this.initialized) return;
    
    const cachedUser = getUserDataFromLocalStorage();
    if (cachedUser) this.user = cachedUser.user;
    
    const keys = getKeysFromLocalStorage();

    // Phase 1: Set up a deferred signer if we have a pubkey
    let deferredSigner: DeferredSigner | null = null;
    if (keys?.pubkey) {
      deferredSigner = new DeferredSigner(keys.pubkey);
      this.signer = deferredSigner;
      this.notify();
    }

    // Phase 2: Restore the real signer in the background
    try {
      const bunkerUri = getBunkerUriInLocalStorage();

      // 1. Try NIP-46 (Bunker)
      if (bunkerUri?.bunkerUri) {
        await this.loginWithNip46(bunkerUri.bunkerUri);
      } 
      // 2. Try NIP-07 (Extension) - only on web
      else if (!isNative && window.nostr && keys?.pubkey && !keys?.secret) {
        await this.loginWithNip07();
      }
      // 3. Try Local Key (Guest/nsec)
      else if (keys?.pubkey && keys?.secret) {
        await this.loginWithLocalKey(keys.pubkey, keys.secret);
      }

      // If we recovered a real signer, resolve the deferred one
      if (deferredSigner && this.signer && this.signer !== deferredSigner) {
        deferredSigner.resolve(this.signer);
      }
    } catch (e) {
      console.error("SignerManager: failed to restore session", e);
    }

    this.initialized = true;
    this.notify();
  }

  private async loginWithLocalKey(pubkey: string, privkey: string) {
    this.signer = createLocalSigner(privkey);
    if (!this.user) {
      await this.saveUser(pubkey);
    }
  }

  async loginWithNsec(nsec: string) {
    const decoded = nip19.decode(nsec);
    if (decoded.type !== 'nsec') throw new Error("Invalid nsec");
    
    const privkey = bytesToHex(decoded.data as Uint8Array);
    this.signer = createLocalSigner(privkey);
    const pubkey = await this.signer.getPublicKey();

    await this.saveUser(pubkey);
    setKeysInLocalStorage(pubkey, privkey);
    this.notify();
  }

  async loginWithNip07() {
    if (!window.nostr) throw new Error("NIP-07 extension not found");
    this.signer = nip07Signer;
    const pubkey = await window.nostr.getPublicKey();
    
    await this.saveUser(pubkey);
    setKeysInLocalStorage(pubkey);
    this.notify();
  }

  async loginWithNip46(bunkerUri: string) {
    const remoteSigner = await createNip46Signer(bunkerUri);
    const pubkey = await remoteSigner.getPublicKey();
    
    this.signer = remoteSigner;
    await this.saveUser(pubkey);
    setKeysInLocalStorage(pubkey);
    setBunkerUriInLocalStorage(bunkerUri);
    this.notify();
  }

  async loginWithNip55(packageName: string, cachedPubkey?: string) {
    const signer = createNIP55Signer(packageName, cachedPubkey);
    const pubkey = await signer.getPublicKey();

    this.signer = signer;
    await this.saveUser(pubkey);
    setKeysInLocalStorage(pubkey);
    // Note: We don't save package name in standard utils yet, 
    // but NIP-55 apps usually handle their own state.
    this.notify();
  }

  async loginWithPrivkey(privkey: string) {
    try {
      let hexKey = privkey;
      if (privkey.startsWith("nsec")) {
        const decoded = nip19.decode(privkey);
        if (decoded.type === "nsec") {
          hexKey = bytesToHex(decoded.data as Uint8Array);
        }
      }

      this.signer = createLocalSigner(hexKey);
      const pubkey = await this.signer.getPublicKey();
      await this.saveUser(pubkey);
      setKeysInLocalStorage(pubkey, hexKey);
    } catch (e: any) {
      throw new Error(e.message || "Invalid private key");
    }
  }

  async loginAsGuest(privkey: string) {
    this.signer = createLocalSigner(privkey);
    const pubkey = await this.signer.getPublicKey();
    await this.saveUser(pubkey);
    setKeysInLocalStorage(pubkey, privkey);
  }

  async logout() {
    this.signer = null;
    this.user = null;
    clearAuthStorage();
    this.notify();
  }

  private async saveUser(pubkey: string, retryCount = 0) {
    try {
      const event = await fetchUserProfile(pubkey);
      const profile = event ? JSON.parse(event.content) : {};
      
      const hasMetadata = !!profile.name || !!profile.picture;
      
      const userData: IUser = {
        pubkey,
        name: profile.name || profile.display_name || ANONYMOUS_USER_NAME,
        picture: profile.picture || DEFAULT_IMAGE_URL,
        about: profile.about,
        nip05: profile.nip05,
        lud16: profile.lud16,
      };
      
      this.user = userData;
      setUserDataInLocalStorage(userData);
      this.notify();

      // If we didn't find metadata and haven't exhausted retries, try again later
      if (!hasMetadata && retryCount < 3) {
        const delays = [5000, 15000, 30000]; // 5s, 15s, 30s intervals
        setTimeout(() => this.saveUser(pubkey, retryCount + 1), delays[retryCount]);
      }

      return userData;
    } catch (e) {
      const fallback: IUser = { pubkey, name: ANONYMOUS_USER_NAME, picture: DEFAULT_IMAGE_URL };
      this.user = fallback;
      this.notify();
      return fallback;
    }
  }

  // --- Getters & Listeners ---

  getSigner(): NostrSigner | null {
    return this.signer;
  }

  getUser(): IUser | null {
    return this.user;
  }

  onUserChange(cb: () => void) {
    this.onChangeCallbacks.add(cb);
    return () => {
      this.onChangeCallbacks.delete(cb);
    };
  }

  private notify() {
    this.onChangeCallbacks.forEach((cb) => cb());
  }
}

// Export a singleton instance
export const signerManager = new SignerManager();
