import React from 'react';
import { Box, Typography } from '@mui/material';
import Plot from 'react-plotly.js';

interface MetricsPanelProps {
  metrics?: {
    visual: number;
    interactive: number;
    functional: number;
    performance: number;
    accessibility: number;
    codeQuality: number;
  };
}

const MetricsPanel: React.FC<MetricsPanelProps> = ({
  metrics = {
    visual: 0,
    interactive: 0,
    functional: 0,
    performance: 0,
    accessibility: 0,
    codeQuality: 0,
  },
}) => {
  const radarData = [{
    type: 'scatterpolar',
    r: [
      metrics.visual,
      metrics.interactive,
      metrics.functional,
      metrics.performance,
      metrics.accessibility,
      metrics.codeQuality,
    ],
    theta: [
      'Visual',
      'Interactive',
      'Functional',
      'Performance',
      'Accessibility',
      'Code Quality',
    ],
    fill: 'toself',
    name: 'Pattern Metrics'
  }];

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Pattern Metrics
      </Typography>
      <Box sx={{ height: 300 }}>
        <Plot
          data={radarData as any}
          layout={{
            polar: {
              radialaxis: {
                visible: true,
                range: [0, 1]
              }
            },
            showlegend: false,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            margin: { t: 0, r: 0, b: 0, l: 0 },
            font: {
              color: '#fff'
            }
          }}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
        />
      </Box>
    </Box>
  );
};

export default MetricsPanel;
