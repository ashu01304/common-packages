import React, { useState, useEffect } from "react";
import { 
  Button, 
  Avatar, 
  Box, 
  Menu, 
  MenuItem, 
  ListItemIcon, 
  ListItemText,
} from "@mui/material";
import { 
  LogoutOutlined as LogoutIcon,
} from "@mui/icons-material";
import { signerManager } from "../core/SignerManager";
import { FormstrAuthModal } from "./FormstrAuthModal";
import { IUser } from "../core/types";

export interface FormstrAuthButtonProps {
  /**
   * Label for the login state.
   */
  label?: string;
  /**
   * Custom title for the modal.
   */
  title?: string;
  /**
   * Custom description for the modal.
   */
  description?: string;
  /**
   * Logo URL for the modal.
   */
  logoUrl?: string;
  /**
   * Custom relays for NIP-46 login.
   */
  customRelays?: string[];
}

/**
 * A ultra-minimal authentication button that shows the profile avatar 
 * on the right and only includes a Logout option in the dropdown.
 */
export const FormstrAuthButton: React.FC<FormstrAuthButtonProps> = ({
  label = "Sign In",
  title,
  description,
  logoUrl,
  customRelays
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [user, setUser] = useState<IUser | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    signerManager.init();
    setUser(signerManager.getUser());
    return signerManager.onUserChange(() => setUser(signerManager.getUser()));
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleLogout = async () => {
    await signerManager.logout();
    handleClose();
  };

  return (
    <>
      {user ? (
        <Box>
          <Button
            onClick={handleClick}
            endIcon={<Avatar src={user.picture} alt={user.name} sx={{ width: 26, height: 26 }} />}
            sx={{ 
              textTransform: "none", 
              borderRadius: 1, 
              fontWeight: 500,
              color: "text.primary",
              border: "1px solid rgba(0,0,0,0.15)",
              px: 1.5,
              fontSize: "13px"
            }}
          >
            {user.name}
          </Button>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
            <MenuItem onClick={handleLogout} sx={{ color: "error.main" }}>
              <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
              <ListItemText sx={{ ".MuiTypography-root": { fontSize: "13px" } }}>Logout</ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      ) : (
        <Button 
          variant="outlined" 
          onClick={() => setModalOpen(true)}
          sx={{ 
            textTransform: "none", 
            borderRadius: 1, 
            fontWeight: 500, 
            color: "black", 
            borderColor: "black",
            fontSize: "13px",
            "&:hover": {
              borderColor: "#333",
              background: "rgba(0,0,0,0.02)"
            }
          }}
        >
          {label}
        </Button>
      )}

      <FormstrAuthModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => setModalOpen(false)}
        title={title}
        description={description}
        logoUrl={logoUrl}
        customRelays={customRelays}
      />
    </>
  );
};
