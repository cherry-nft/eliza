import React, { useEffect, useState } from 'react';
import { Box, Container, Grid, Paper } from '@mui/material';
import PatternPreview from './components/PatternPreview';
import EmbeddingVisualizer from './components/EmbeddingVisualizer';
import MetricsPanel from './components/MetricsPanel';
import Controls from './components/Controls';
import PromptInput from './components/PromptInput';
import { patternService } from './services/PG-PatternService';
import { GamePattern } from '../../src/types/patterns';
import { PatternEffectivenessMetrics } from '../../src/types/effectiveness';

const App: React.FC = () => {
  const [patterns, setPatterns] = useState<GamePattern[]>([]);
  const [selectedPattern, setSelectedPattern] = useState<GamePattern | null>(null);
  const [claudeOutput, setClaudeOutput] = useState<{
    plan: {
      coreMechanics: string[];
      visualElements: string[];
      interactionFlow: string[];
      stateManagement: string[];
      assetRequirements: string[];
    };
    title: string;
    description: string;
    html: string;
    thumbnail: {
      alt: string;
      backgroundColor: string;
      elements: Array<{
        type: "rect" | "circle" | "path";
        attributes: Record<string, string>;
      }>;
    };
  } | null>(null);
  const [metrics, setMetrics] = useState<PatternEffectivenessMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initializePatterns = async () => {
      await patternService.initialize();
      const loadedPatterns = await patternService.getPatterns();
      setPatterns(loadedPatterns);
      if (loadedPatterns.length > 0) {
        setSelectedPattern(loadedPatterns[0]);
      }
    };
    initializePatterns();
  }, []);

  const handlePromptSubmit = async (prompt: string) => {
    setLoading(true);
    try {
      // Generate pattern using Claude
      const generatedPattern = await patternService.generateFromPrompt(prompt);
      setClaudeOutput(generatedPattern);

      // Find similar patterns
      if (patterns.length > 0) {
        // Use the first pattern as a reference for now
        const similarPatterns = await patternService.searchSimilarPatterns(patterns[0]);
        if (similarPatterns.length > 0) {
          setSelectedPattern(similarPatterns[0]);
          // Compare generated pattern with similar pattern
          const metrics = await patternService.comparePatterns(generatedPattern.html, similarPatterns[0]);
          setMetrics(metrics);
        }
      }
    } catch (error) {
      console.error('Error processing prompt:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Grid container spacing={3}>
        {/* Prompt Input */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <PromptInput onSubmit={handlePromptSubmit} loading={loading} />
          </Paper>
        </Grid>

        {/* Preview Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, minHeight: '500px' }}>
            <Box sx={{ mb: 2 }}>
              <h3>{claudeOutput?.title || 'Claude Output'}</h3>
              <p>{claudeOutput?.description}</p>
            </Box>
            <PatternPreview
              html={claudeOutput?.html || '<!-- Generated HTML will appear here -->'}
            />
          </Paper>
        </Grid>

        {/* Similar Pattern Preview */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, minHeight: '500px' }}>
            <Box sx={{ mb: 2 }}>
              <h3>Similar Pattern</h3>
            </Box>
            <PatternPreview
              html={selectedPattern?.content.html}
              css={selectedPattern?.content.css}
              js={selectedPattern?.content.js}
            />
          </Paper>
        </Grid>

        {/* Pattern Space Visualization */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '400px' }}>
            <EmbeddingVisualizer
              embeddings={patterns.map(p => ({
                id: p.id,
                vector: p.embedding || [0, 0],
                label: p.pattern_name,
                type: p.type
              }))}
            />
          </Paper>
        </Grid>

        {/* Comparison & Feedback */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <MetricsPanel
              metrics={metrics ? {
                visual: metrics.quality_scores.visual,
                interactive: metrics.quality_scores.interactive,
                functional: metrics.quality_scores.functional,
                performance: metrics.quality_scores.performance,
                accessibility: 0.5,
                codeQuality: 0.5
              } : undefined}
            />
            <Controls
              onParameterChange={(param, value) => {
                console.log('Parameter changed:', param, value);
              }}
            />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default App;
