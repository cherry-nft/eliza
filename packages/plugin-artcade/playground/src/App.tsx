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
  console.log('App component rendering');

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
    console.log('Initial useEffect running');
    const initializePatterns = async () => {
      console.log('Initializing patterns');
      await patternService.initialize();
      const loadedPatterns = await patternService.getPatterns();
      console.log('Loaded patterns:', loadedPatterns);
      setPatterns(loadedPatterns);
      if (loadedPatterns.length > 0) {
        console.log('Setting initial selected pattern:', loadedPatterns[0]);
        setSelectedPattern(loadedPatterns[0]);
      }
    };
    initializePatterns();
  }, []);

  useEffect(() => {
    console.log('Selected pattern changed:', selectedPattern);
  }, [selectedPattern]);

  useEffect(() => {
    console.log('Claude output changed:', claudeOutput);
  }, [claudeOutput]);

  useEffect(() => {
    console.log('Metrics changed:', metrics);
  }, [metrics]);

  const handlePromptSubmit = async (prompt: string) => {
    console.log('Handling prompt submit:', prompt);
    setLoading(true);
    try {
      console.log('Generating pattern from prompt');
      const generatedPattern = await patternService.generateFromPrompt(prompt);
      console.log('Generated pattern:', generatedPattern);
      setClaudeOutput(generatedPattern);

      if (patterns.length > 0) {
        console.log('Creating game pattern from Claude output');
        const generatedGamePattern: GamePattern = {
          id: 'generated',
          type: 'game_mechanic',
          pattern_name: generatedPattern.title,
          content: {
            html: generatedPattern.html,
            context: 'game',
            metadata: {
              game_mechanics: generatedPattern.plan.coreMechanics.map(mechanic => ({
                type: mechanic,
                properties: {}
              }))
            }
          },
          embedding: [],
          effectiveness_score: 1.0,
          usage_count: 0
        };
        console.log('Created game pattern:', generatedGamePattern);

        console.log('Searching for similar patterns');
        const similarPatterns = await patternService.searchSimilarPatterns(generatedGamePattern);
        console.log('Found similar patterns:', similarPatterns);

        if (similarPatterns.length > 0) {
          console.log('Setting selected pattern:', similarPatterns[0]);
          setSelectedPattern(similarPatterns[0]);

          console.log('Comparing patterns');
          const metrics = await patternService.comparePatterns(generatedPattern.html, similarPatterns[0]);
          console.log('Pattern comparison metrics:', metrics);
          setMetrics(metrics);
        }
      }
    } catch (error) {
      console.error('Error processing prompt:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEvolvePattern = async () => {
    console.log('Handling evolve pattern');
    if (!claudeOutput) {
      console.log('No Claude output to evolve');
      return;
    }

    setLoading(true);
    try {
      console.log('Creating current pattern for evolution');
      const currentPattern: GamePattern = {
        id: 'current',
        type: selectedPattern?.type || 'game_mechanic',
        pattern_name: claudeOutput.title,
        content: {
          html: claudeOutput.html,
          context: 'game',
          metadata: {
            game_mechanics: claudeOutput.plan.coreMechanics.map(mechanic => ({
              type: mechanic,
              properties: {}
            }))
          }
        },
        embedding: [],
        effectiveness_score: 1.0,
        usage_count: 0
      };
      console.log('Current pattern for evolution:', currentPattern);

      console.log('Evolving pattern');
      const evolvedPattern = await patternService.evolvePattern(currentPattern, {
        mutationRate: 0.3,
        populationSize: 10
      });
      console.log('Evolved pattern:', evolvedPattern);

      console.log('Updating Claude output with evolved pattern');
      setClaudeOutput({
        ...claudeOutput,
        html: evolvedPattern.content.html
      });

      console.log('Searching for similar patterns to evolved pattern');
      const similarPatterns = await patternService.searchSimilarPatterns(evolvedPattern);
      console.log('Found similar patterns:', similarPatterns);

      if (similarPatterns.length > 0) {
        console.log('Setting selected pattern:', similarPatterns[0]);
        setSelectedPattern(similarPatterns[0]);

        console.log('Comparing evolved pattern');
        const metrics = await patternService.comparePatterns(evolvedPattern.content.html, similarPatterns[0]);
        console.log('Evolution comparison metrics:', metrics);
        setMetrics(metrics);
      }
    } catch (error) {
      console.error('Error evolving pattern:', error);
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

        {/* Controls */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Controls
              selectedPattern={selectedPattern}
              onEvolve={handleEvolvePattern}
              onReset={() => {
                setClaudeOutput(null);
                setSelectedPattern(patterns[0]);
              }}
              onParameterChange={(param, value) => {
                if (param === 'type' && selectedPattern) {
                  setSelectedPattern({
                    ...selectedPattern,
                    type: value as GamePattern['type']
                  });
                }
              }}
            />
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
              selectedPattern={selectedPattern}
              onEvolve={handleEvolvePattern}
              onParameterChange={(param, value) => {
                console.log('Parameter changed in second Controls:', param, value);
                if (param === 'type' && selectedPattern) {
                  console.log('Updating pattern type to:', value);
                  setSelectedPattern({
                    ...selectedPattern,
                    type: value as GamePattern['type']
                  });
                }
              }}
            />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default App;
