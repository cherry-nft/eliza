import React from 'react';
import {
  Box,
  Typography,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Grid,
  Alert
} from '@mui/material';
import { GamePattern } from '../../../src/types/patterns';

interface ControlsProps {
  onEvolve?: () => void;
  onReset?: () => void;
  onParameterChange?: (param: string, value: any) => void;
  selectedPattern?: GamePattern | null;
  evolutionErrors?: string[];
}

const Controls: React.FC<ControlsProps> = ({
  onEvolve,
  onReset,
  onParameterChange = () => {},
  selectedPattern,
  evolutionErrors = []
}) => {
  const patternTypes = [
    'animation',
    'layout',
    'interaction',
    'style',
    'game_mechanic'
  ] as const;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Pattern Controls
      </Typography>

      {evolutionErrors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {evolutionErrors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Pattern Type Selection */}
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>Pattern Type</InputLabel>
            <Select
              value={patternTypes.includes(selectedPattern?.type as any) ? selectedPattern?.type : 'style'}
              onChange={(e) => {
                console.log('Pattern type changed:', e.target.value);
                onParameterChange('type', e.target.value);
              }}
              label="Pattern Type"
            >
              {patternTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Evolution Parameters */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Evolution Parameters
          </Typography>
          <Box sx={{ px: 1 }}>
            <Typography>Mutation Rate</Typography>
            <Slider
              defaultValue={0.3}
              min={0}
              max={1}
              step={0.1}
              valueLabelDisplay="auto"
              onChange={(_, value) => onParameterChange('mutationRate', value)}
            />
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ px: 1 }}>
            <Typography>Population Size</Typography>
            <Slider
              defaultValue={10}
              min={5}
              max={50}
              step={5}
              valueLabelDisplay="auto"
              onChange={(_, value) => onParameterChange('populationSize', value)}
            />
          </Box>
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={6}>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={onEvolve}
          >
            Evolve Pattern
          </Button>
        </Grid>
        <Grid item xs={6}>
          <Button
            variant="outlined"
            color="secondary"
            fullWidth
            onClick={onReset}
          >
            Reset
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Controls;
