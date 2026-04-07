import React, { useEffect, useState, type ReactNode } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  Button,
  Dialog,
  Tabs,
  Tab,
  Stack,
  TextField,
  Typography,
  Alert,
  IconButton,
  Box,
  ButtonBase,
  Divider,
  CircularProgress,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import PhonelinkLockOutlinedIcon from "@mui/icons-material/PhonelinkLockOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { signerManager } from "../core/SignerManager";
import { getAppSecretKeyFromLocalStorage } from "../core/utils";
import { getPublicKey, generateSecretKey } from "nostr-tools";
import { bytesToHex } from "nostr-tools/utils";
import { createNostrConnectURI, Nip46Relays } from "../core/nip46";
import { isAndroidNative, isNative } from "../utils/platform";
import { NostrSigner } from "../core/types";

// --- Sub-components ---

const OptionButton: React.FC<{
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  showChevron?: boolean;
  chevronRotated?: boolean;
}> = ({ icon, title, description, onClick, showChevron, chevronRotated }) => {
  const theme = useTheme();
  const accent = theme.palette.primary.main;
  const alpha = theme.palette.mode === "dark" ? "22" : "18";

  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 2,
        px: 2.5,
        py: 1.75,
        textAlign: "left",
        transition: "background 0.15s",
        "&:hover": { bgcolor: `${accent}${alpha}` },
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          bgcolor: `${accent}${alpha}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: accent,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box flex={1} minWidth={0}>
        <Typography variant="body1" fontWeight={600} lineHeight={1.3}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {description}
        </Typography>
      </Box>
      {showChevron && (
        <ChevronRightIcon
          sx={{
            color: "text.secondary",
            opacity: 0.5,
            flexShrink: 0,
            transition: "transform 0.2s",
            transform: chevronRotated ? "rotate(90deg)" : "none",
          }}
        />
      )}
    </ButtonBase>
  );
};

const Nip46Section: React.FC<{ onSuccess: () => void; onError: (msg: string) => void; relays: string[] }> = ({
  onSuccess,
  onError,
  relays
}) => {
  const [activeTab, setActiveTab] = useState("manual");
  const [bunkerUri, setBunkerUri] = useState("");
  const [loading, setLoading] = useState(false);

  const [copied, setCopied] = useState(false);

  const [qrPayload] = useState(() => {
    const clientSecretKey = getAppSecretKeyFromLocalStorage();
    const clientPubkey = getPublicKey(clientSecretKey);
    const secret = Math.random().toString(36).slice(2, 10);
    return createNostrConnectURI({
      clientPubkey,
      relays: relays,
      secret,
      perms: ["nip44_encrypt", "nip44_decrypt", "sign_event", "get_public_key"],
      name: "Formstr Auth",
    });
  });

  const connect = async (uri: string) => {
    const cleanUri = uri.trim();
    if (!cleanUri) return;
    onError(""); // Clear previous errors
    setLoading(true);
    try {
      await signerManager.loginWithNip46(cleanUri);
      onSuccess();
    } catch (e: any) {
      onError(e.message || "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(qrPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box sx={{ px: 2, pb: 2, bgcolor: "action.hover" }}>
      <Tabs
        value={activeTab}
        onChange={(_e, val) => {
          setActiveTab(val);
          onError(""); // Clear error when switching tabs
          if (val === "qr") connect(qrPayload);
        }}
        sx={{ mb: 1 }}
      >
        <Tab label="Paste URI" value="manual" sx={{ textTransform: "none" }} />
        <Tab label="QR Code" value="qr" sx={{ textTransform: "none" }} />
      </Tabs>

      {activeTab === "manual" && (
        <Stack spacing={1} direction="row">
          <TextField
            size="small"
            fullWidth
            placeholder="bunker://... or name@domain.com"
            value={bunkerUri}
            onChange={(e) => setBunkerUri(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && connect(bunkerUri)}
          />
          <Button
            variant="contained"
            onClick={() => connect(bunkerUri)}
            disabled={loading || !bunkerUri.trim()}
          >
            {loading ? <CircularProgress size={20} /> : "Connect"}
          </Button>
        </Stack>
      )}

      {activeTab === "qr" && (
        <Box textAlign="center" py={1}>
          <QRCodeCanvas value={qrPayload} size={160} />
          <Box display="flex" justifyContent="center" alignItems="center" mt={1}>
            <IconButton size="small" onClick={handleCopy}>
              <ContentCopyIcon fontSize="small" color={copied ? "success" : "inherit"} />
            </IconButton>
            <Typography variant="caption" color={copied ? "success.main" : "text.secondary"}>
              {copied ? "Copied!" : "Copy Connection URI"}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
};

const NsecSection: React.FC<{ onSuccess: () => void; onError: (msg: string) => void }> = ({
  onSuccess,
  onError
}) => {
  const [nsec, setNsec] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const cleanNsec = nsec.trim();
    if (!cleanNsec) return;
    onError(""); // Clear previous errors
    setLoading(true);
    try {
      await signerManager.loginWithPrivkey(cleanNsec);
      onSuccess();
    } catch (e: any) {
      onError(e.message || "Invalid private key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ px: 2, pb: 2, pt: 1, bgcolor: "action.hover" }}>
      <Stack spacing={1} direction="row">
        <TextField
          size="small"
          fullWidth
          type="password"
          placeholder="nsec1..."
          value={nsec}
          onChange={(e) => setNsec(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />
        <Button
          variant="contained"
          onClick={handleLogin}
          disabled={loading || !nsec.trim()}
          sx={{ textTransform: "none" }}
        >
          {loading ? <CircularProgress size={20} /> : "Login"}
        </Button>
      </Stack>
    </Box>
  );
};

// --- Main Modal ---

import FORMSTR_LOGO from "../assets/logo.png";

export interface FormstrAuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (signer: NostrSigner) => void;
  title?: string;
  description?: string;
  logoUrl?: string;
  customRelays?: string[];
}

export const FormstrAuthModal: React.FC<FormstrAuthModalProps> = ({
  open,
  onClose,
  onSuccess,
  title = "Sign in to Formstr",
  description = "Choose your preferred login method",
  logoUrl = FORMSTR_LOGO,
  customRelays = Nip46Relays,
}) => {
  const theme = useTheme();
  const [showNip46, setShowNip46] = useState(false);
  const [showNsec, setShowNsec] = useState(false);
  const [error, setError] = useState("");
  const [installedSigners, setInstalledSigners] = useState<{ packageName: string; name: string; iconUrl?: string }[]>([]);

  useEffect(() => {
    if (!open) {
      setShowNip46(false);
      setShowNsec(false);
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (isAndroidNative()) {
      import("nostr-signer-capacitor-plugin").then(({ NostrSignerPlugin }) => {
        NostrSignerPlugin.getInstalledSignerApps().then((res) => {
          setInstalledSigners(res.apps);
        });
      });
    }
  }, []);

  const handleSuccess = () => {
    const signer = signerManager.getSigner();
    if (signer) onSuccess(signer);
    onClose();
  };

  const handleNip07 = async () => {
    setError("");
    try {
      await signerManager.loginWithNip07();
      handleSuccess();
    } catch (e: any) {
      setError(e.message || "Extension login failed");
    }
  };

  const handleGuest = async () => {
    setError("");
    try {
      const key = bytesToHex(generateSecretKey());
      await signerManager.loginAsGuest(key);
      handleSuccess();
    } catch (e: any) {
      setError(e.message || "Guest login failed");
    }
  };

  const handleNip55 = async (packageName: string) => {
    setError("");
    try {
      await signerManager.loginWithNip55(packageName);
      handleSuccess();
    } catch (e: any) {
      setError(e.message || "External signer failed");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}
    >
      {/* Header */}
      <Box sx={{ px: 3, pt: 4, pb: 3, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
        {logoUrl && <img src={logoUrl} alt="Logo" style={{ width: 84, height: 84, borderRadius: 16, objectFit: "contain" }} />}
        <Box textAlign="center">
          <Typography variant="h6" fontWeight={700}>{title}</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>{description}</Typography>
        </Box>
        {error && <Alert severity="error" sx={{ width: "100%", borderRadius: 2 }}>{error}</Alert>}
      </Box>

      {/* Options */}
      <Stack divider={<Divider />}>
        {!isNative && (
          <OptionButton
            icon={<VpnKeyOutlinedIcon />}
            title="Browser Extension"
            description="Sign with Alby, nos2x, or Flamingo"
            onClick={handleNip07}
          />
        )}

        {isAndroidNative() && (
          <>
            {installedSigners.map((app) => (
              <OptionButton
                key={app.packageName}
                icon={app.iconUrl ? <img src={app.iconUrl} alt={app.name} style={{ width: 24, height: 24, borderRadius: 4 }} /> : <PhonelinkLockOutlinedIcon />}
                title={app.name}
                description="Sign with external Android app"
                onClick={() => handleNip55(app.packageName)}
              />
            ))}
            {installedSigners.length === 0 && (
              <OptionButton
                icon={<PhonelinkLockOutlinedIcon />}
                title="External Signer"
                description="Sign using a NIP-55 compatible app"
                onClick={() => handleNip55("com.greenart7c3.nostrsigner")}
              />
            )}
          </>
        )}

        <Box>
          <OptionButton
            icon={<HubOutlinedIcon />}
            title="Remote Signer"
            description="Connect via NIP-46 (Bunker)"
            onClick={() => {
              setShowNip46(!showNip46);
              setShowNsec(false);
            }}
            showChevron
            chevronRotated={showNip46}
          />
          {showNip46 && <Nip46Section onSuccess={handleSuccess} onError={setError} relays={customRelays} />}
        </Box>

        {isAndroidNative() && (
          <Box>
            <OptionButton
              icon={<VpnKeyOutlinedIcon />}
              title="Private Key"
              description="Sign-in with your nsec key"
              onClick={() => {
                setShowNsec(!showNsec);
                setShowNip46(false);
              }}
              showChevron
              chevronRotated={showNsec}
            />
            {showNsec && <NsecSection onSuccess={handleSuccess} onError={setError} />}
          </Box>
        )}

        <OptionButton
          icon={<PersonOutlinedIcon />}
          title="Temporary Account"
          description="Instant access, persists in this browser"
          onClick={handleGuest}
        />
      </Stack>

      {/* Footer */}
      <Box sx={{ px: 3, py: 1.5, borderTop: `1px solid ${theme.palette.divider}`, textAlign: "center" }}>
        <Typography variant="caption" color="text.secondary">Your private keys never leave your device.</Typography>
      </Box>
    </Dialog>
  );
};
