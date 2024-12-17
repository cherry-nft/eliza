import React, { useState } from 'react';
import { Box, Button, CircularProgress, TextField, Typography } from '@mui/material';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  loading?: boolean;
}

const PromptInput: React.FC<PromptInputProps> = ({ onSubmit, loading = false }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !loading) {
      onSubmit(prompt.trim());
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h6" gutterBottom>
        Enter Your Prompt
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Example: "Create a car racing game with score tracking and power-ups"
      </Typography>
      <TextField
        fullWidth
        multiline
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the HTML experience you want to create..."
        variant="outlined"
        disabled={loading}
        sx={{ mb: 2 }}
      />
      <Button
        type="submit"
        variant="contained"
        disabled={!prompt.trim() || loading}
        endIcon={loading ? <CircularProgress size={20} /> : null}
      >
        Generate Pattern
      </Button>
    </Box>
  );
};

export default PromptInput;