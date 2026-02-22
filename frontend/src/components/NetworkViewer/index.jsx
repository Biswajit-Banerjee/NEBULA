import React, { useState, useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle, useContext } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import styled from 'styled-components';
import * as d3 from 'd3';
import { ThemeContext } from '../ThemeProvider/ThemeProvider';
import GenerationControls from '../NetworkViewer2D/GenerationControls';

// =============================================================================
// Styled Components
// =============================================================================

// API fetch function
const fetchNodeData = async (nodeType, nodeId) => {
  try {
    const response = await fetch(`/api/${nodeType}/${nodeId}`);
    if (!response.ok) {
      throw new Error(`Error fetching ${nodeType} data: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${nodeType} data:`, error);
    return null;
  }
};

const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: ${props => props.$dark ? 'radial-gradient(ellipse at center, #1a2130 0%, #090a0f 100%)' : '#F9FAFB'};
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  
  /* Vignette overlay for enhanced depth perception */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none; /* make overlay non-interactive */
    border-radius: inherit;
    background: ${props => props.$dark
      ? 'radial-gradient(circle at center, rgba(0,0,0,0) 60%, rgba(0,0,0,0.65) 100%)'
      : 'radial-gradient(circle at center, rgba(255,255,255,0) 60%, rgba(0,0,0,0.25) 100%)'};
  }
  
  &:fullscreen {
    border-radius: 0;
  }
`;

const ControlPanel = styled.div`
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 10;
  background: ${props => props.$dark ? 'rgba(30,39,51,0.85)' : 'rgba(255,255,255,0.85)'};
  backdrop-filter: blur(6px);
  padding: 15px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  color: ${props => props.$dark ? '#e0e0e0' : '#374151'};
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 300px;
  transition: all 0.3s ease;
  border: 1px solid ${props => props.$dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};

  &:hover {
    background: ${props => props.$dark ? 'rgba(40,49,61,0.9)' : 'rgba(255,255,255,0.9)'};
  }
`;

const SliderContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
`;

const SliderLabel = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #abb4c5;
`;

const Slider = styled.input`
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  background: rgba(80, 100, 130, 0.3);
  border-radius: 3px;
  outline: none;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #4a9fff;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }
  
  &::-webkit-slider-thumb:hover {
    background: #65aeff;
    transform: scale(1.1);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
`;

const Button = styled.button`
  background: ${props => props.$active ? 'rgba(74,159,255,0.2)' : (props.$dark ? 'rgba(60,70,90,0.5)' : 'rgba(240,244,250,0.9)')};
  color: ${props => props.$active ? '#4a9fff' : (props.$dark ? '#d0d0d0' : '#374151')};
  border: 1px solid ${props => props.$active ? 'rgba(74, 159, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)'};
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;

  &:hover {
    background: ${props => props.$active ? 'rgba(74,159,255,0.35)' : (props.$dark ? 'rgba(40,49,61,0.9)' : 'rgba(226,232,240,1)')};
  }

  &:active {
    transform: translateY(1px);
  }

  svg {
    margin-right: ${props => props.$iconOnly ? '0' : '5px'};
  }
`;

const OptionsPanel = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
  background: ${props => props.$dark ? 'rgba(30,39,51,0.85)' : 'rgba(255,255,255,0.9)'};
  backdrop-filter: blur(6px);
  padding: 15px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  color: ${props => props.$dark ? '#e0e0e0' : '#374151'};
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 240px;
  transition: all 0.3s ease;
  border: 1px solid ${props => props.$dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
`;

const Option = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const OptionLabel = styled.label`
  font-size: 13px;
  color: #abb4c5;
  cursor: pointer;
`;

const Toggle = styled.div`
  position: relative;
  width: 40px;
  height: 20px;
`;

const ToggleInput = styled.input`
  opacity: 0;
  width: 0;
  height: 0;
  
  &:checked + span {
    background-color: #4a9fff;
  }
  
  &:checked + span:before {
    transform: translateX(20px);
  }
`;

const ToggleSlider = styled.span`
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(80, 100, 130, 0.3);
  transition: 0.4s;
  border-radius: 34px;
  
  &:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 2px;
    bottom: 2px;
    background-color: white;
    transition: 0.4s;
    border-radius: 50%;
  }
`;

const Select = styled.select`
  background: rgba(60, 70, 90, 0.5);
  color: #d0d0d0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
  width: 120px;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(80, 100, 130, 0.7);
    border-color: rgba(255, 255, 255, 0.2);
  }
  
  option {
    background: #1e2733;
  }
`;

const LoadingOverlay = styled.div`
  position: absolute;
  display: ${props => props.$loading ? 'flex' : 'none'};
  justify-content: center;
  align-items: center;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(10, 15, 25, 0.8);
  z-index: 20;
  color: white;
  font-size: 18px;
  flex-direction: column;
`;

const Spinner = styled.div`
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  border-top: 4px solid #4a9fff;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const TopLeftButtonGroup = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 20;
  display: flex;
  gap: 10px;
`;

const ControlButton = styled.button`
  background: ${({ $active, $dark }) =>
    $active
      ? $dark
        ? 'rgba(74, 159, 255, 0.3)'
        : 'rgba(96, 165, 250, 0.3)'
      : $dark
      ? 'rgba(30, 39, 51, 0.85)'
      : 'rgba(255, 255, 255, 0.85)'};
  backdrop-filter: blur(6px);
  padding: 8px 12px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  color: ${({ $active, $dark }) =>
    $active ? '#fff' : $dark ? '#e0e0e0' : '#374151'};
  border: 1px solid
    ${({ $active, $dark }) =>
      $active
        ? 'rgba(74, 159, 255, 0.5)'
        : $dark
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(0, 0, 0, 0.05)'};
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;

  &:hover {
    background: ${({ $active, $dark }) =>
      $active
        ? $dark
          ? 'rgba(74, 159, 255, 0.4)'
          : 'rgba(96, 165, 250, 0.4)'
        : $dark
        ? 'rgba(40, 49, 61, 0.9)'
        : 'rgba(243, 244, 246, 1)'};
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const AxisControls = styled.div`
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 20;
  background: ${props => props.$dark ? 'rgba(30,39,51,0.85)' : 'rgba(255,255,255,0.9)'};
  backdrop-filter: blur(6px);
  padding: 15px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  color: ${props => props.$dark ? '#e0e0e0' : '#374151'};
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  transition: all 0.3s ease;
  border: 1px solid ${props => props.$dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
`;

const AxisButton = styled.button`
  background: ${props => props.$dark ? 'rgba(60,70,90,0.5)' : 'rgba(240,244,250,0.9)'};
  color: ${props => props.$dark ? '#d0d0d0' : '#374151'};
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 8px;
  font-size: 13px;
  font-weight: ${props => props.$center ? 'bold' : 'normal'};
  cursor: pointer;
  transition: all 0.2s ease;
  touch-action: none; /* Prevent scrolling when holding button on touchscreens */
  
  &:hover {
    background: ${props => props.$dark ? 'rgba(80,100,130,0.7)' : 'rgba(226,232,240,1)'};
    border-color: rgba(0, 0, 0, 0.1);
  }
  
  &:active {
    background: rgba(100, 120, 150, 0.8);
  }
  
  &.x-axis {
    color: #ff6b6b;
  }
  
  &.y-axis {
    color: #59d4a0;
  }
  
  &.z-axis {
    color: #4a9fff;
  }
`;

const NodeInfoPanel = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  bottom: 20px;
  width: 300px;
  z-index: 30;
  background: rgba(20, 29, 41, 0.9);
  backdrop-filter: blur(10px);
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  color: #e0e0e0;
  overflow-y: auto;
  transform: ${props => props.$visible ? 'translateX(0)' : 'translateX(320px)'};
  transition: transform 0.3s ease-in-out;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 15px;
  right: 15px;
  background: none;
  border: none;
  color: #abb4c5;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
  
  &:hover {
    color: white;
  }
`;

const NodeInfoTitle = styled.h3`
  margin-top: 0;
  margin-bottom: 15px;
  padding-bottom: 10px;
  font-size: 18px;
  color: white;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const NodeInfoSection = styled.div`
  margin-bottom: 16px;
`;

const NodeInfoSectionTitle = styled.h4`
  margin-top: 0;
  margin-bottom: 8px;
  font-size: 14px;
  color: #abb4c5;
`;

const NodeInfoTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  
  td {
    padding: 6px 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  
  tr:last-child td {
    border-bottom: none;
  }
  
  td:first-child {
    color: #abb4c5;
    width: 40%;
  }
  
  td:last-child {
    color: white;
    width: 60%;
  }
`;

const NodeInfoPre = styled.pre`
  background: rgba(0, 0, 0, 0.2);
  padding: 10px;
  border-radius: 6px;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  max-height: 300px;
  overflow-y: auto;
`;

// Search bar styles
const SearchContainer = styled.div`
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 25;
  display: flex;
  gap: 8px;
  align-items: center;
  background: ${props => props.$dark ? 'rgba(30,39,51,0.85)' : 'rgba(255,255,255,0.9)'};
  backdrop-filter: blur(6px);
  border: 1px solid ${props => props.$dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
  border-radius: 10px;
  padding: 8px 10px;
`;

const SearchInput = styled.input`
  border: none;
  outline: none;
  background: transparent;
  color: ${props => props.$dark ? '#e5e7eb' : '#111827'};
  min-width: 220px;
  font-size: 13px;
`;

const SearchBtn = styled.button`
  background: ${props => props.$dark ? 'rgba(60,70,90,0.5)' : 'rgba(240,244,250,0.9)'};
  color: ${props => props.$dark ? '#d0d0d0' : '#374151'};
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
`;

// Help overlay styles
const HelpOverlayBackdrop = styled.div`
  position: absolute;
  inset: 0;
  z-index: 40;
  background: rgba(0, 0, 0, 0.45);
  display: ${props => props.$visible ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
`;

const HelpOverlayCard = styled.div`
  background: ${props => props.$dark ? 'rgba(30,39,51,0.95)' : 'rgba(255,255,255,0.98)'};
  color: ${props => props.$dark ? '#e5e7eb' : '#374151'};
  padding: 20px;
  border-radius: 12px;
  width: 520px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.35);
  border: 1px solid ${props => props.$dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'};
`;

const HelpTitle = styled.h3`
  margin: 0 0 10px 0;
  color: ${props => props.$dark ? '#fff' : '#111827'};
`;

const HelpList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 14px;
  font-size: 13px;
`;

const HelpKey = styled.code`
  background: ${props => props.$dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'};
  border: 1px solid ${props => props.$dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'};
  border-radius: 6px;
  padding: 2px 6px;
  margin-right: 8px;
  display: inline-block;
`;

// =============================================================================
// Main Component
// =============================================================================

const NetworkViewer3D = forwardRef(({ results, height }, ref) => {
  // State variables
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [currentGeneration, setCurrentGeneration] = useState(0);
  const [maxGeneration, setMaxGeneration] = useState(0);
  const [minGeneration, setMinGeneration] = useState(0);
  const [minVisibleGeneration, setMinVisibleGeneration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playInterval, setPlayInterval] = useState(null);
  const [hideLabels, setHideLabels] = useState(false);
  const [hideEC, setHideEC] = useState(false);
  const [layoutMode, setLayoutMode] = useState('force'); // 'force', 'tornado', 'globe'
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nodesLocked, setNodesLocked] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeApiData, setNodeApiData] = useState(null);
  const [nodeInfoVisible, setNodeInfoVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [repulsion, setRepulsion] = useState(120);
  const [linkDistance, setLinkDistance] = useState(50);
  const [playSpeed, setPlaySpeed] = useState(1500);
  const fgRef = useRef();
  const containerRef = useRef();
  const rotateIntervalRef = useRef(null);
  const { dark } = useContext(ThemeContext);
  const [showOptions, setShowOptions] = useState(false);
  const [hoverNode, setHoverNode] = useState(null);
  const [hoverLink, setHoverLink] = useState(null);
  const [neighborsMap, setNeighborsMap] = useState(new Map());
  const [searchQuery, setSearchQuery] = useState("");

  // 2D-like transition speed (1..10) mapped to ms play speed
  const [transitionSpeed, setTransitionSpeed] = useState(5);
  useEffect(() => {
    const ms = 200 + (10 - transitionSpeed) * 280; // 10->200ms, 1->~2720ms
    setPlaySpeed(ms);
  }, [transitionSpeed]);

  // =============================================================================
  // Data Processing Functions
  // =============================================================================

  // Process graph data from reaction results
  const processGraphData = (reactions) => {
    const nodes = new Map();
    const links = [];
    let nodeIndex = 0;
    
    // First pass: create all compound nodes with generation 0
    reactions.forEach(reaction => {
      const { compound_generation } = reaction;
      
      // Create compound nodes
      Object.entries(compound_generation).forEach(([compoundId, generation]) => {
        if (!nodes.has(compoundId)) {
          nodes.set(compoundId, {
            id: compoundId,
            label: compoundId,
            type: 'compound',
            generation,
            val: 1.5, // Node size
            x: (Math.random() * 200 - 100) * (generation + 1), // More spread for higher generations
            y: (Math.random() * 200 - 100) * (generation + 1),
            z: (Math.random() * 200 - 100) * (generation + 1),
            index: nodeIndex++
          });
        }
      });
    });
    
    // Second pass: create reaction nodes and links for each generation transition
    reactions.forEach(reaction => {
      const { reaction: reactionId, equation, transition, ec_list, coenzyme } = reaction;
      
      // Extract generation transition
      const [fromGen, toGen] = transition.split('->').map(gen => parseInt(gen.trim()));
      
      // Parse equation to extract compounds and coefficients
      const [reactantsStr, productsStr] = equation.split('=>').map(side => side.trim());
      
      // Process reactants (left side)
      const reactantItems = reactantsStr.split('+').map(item => {
        const trimmed = item.trim();
        // Match coefficient and KEGG compound ID (C##### or Z##### format)
        const matches = trimmed.match(/^(\d*)((?:C|Z)\d{5})$/i);
        if (matches) {
          return {
            id: matches[2],
            coefficient: matches[1] ? parseInt(matches[1]) : 1
          };
        }
        // Handle edge cases - try generic pattern for other compound formats
        const genericMatch = trimmed.match(/^(\d*)([A-Za-z0-9_\-]+)$/);
        if (genericMatch) {
          return {
            id: genericMatch[2],
            coefficient: genericMatch[1] ? parseInt(genericMatch[1]) : 1
          };
        }
        return { id: trimmed, coefficient: 1 };
      });
      
      // Process products (right side)
      const productItems = productsStr.split('+').map(item => {
        const trimmed = item.trim();
        // Match coefficient and KEGG compound ID (C##### or Z##### format)
        const matches = trimmed.match(/^(\d*)((?:C|Z)\d{5})$/i);
        if (matches) {
          return {
            id: matches[2],
            coefficient: matches[1] ? parseInt(matches[1]) : 1
          };
        }
        // Handle edge cases - try generic pattern for other compound formats
        const genericMatch = trimmed.match(/^(\d*)([A-Za-z0-9_\-]+)$/);
        if (genericMatch) {
          return {
            id: genericMatch[2],
            coefficient: genericMatch[1] ? parseInt(genericMatch[1]) : 1
          };
        }
        return { id: trimmed, coefficient: 1 };
      });
      
      // Create reactant and product nodes for the reaction
      const reactantNodeId = `${reactionId}_reactant`;
      const productNodeId = `${reactionId}_product`;
      
      // Add reactant node (for transition fromGen -> toGen)
      nodes.set(reactantNodeId, {
        id: reactantNodeId,
        label: reactionId,
        type: 'reaction',
        subtype: 'reactant',
        generation: fromGen,
        transitionTo: toGen,
        val: 1.2,
        coenzyme,
        x: (Math.random() * 150 - 75) * (fromGen + 1),
        y: (Math.random() * 150 - 75) * (fromGen + 1),
        z: (Math.random() * 150 - 75) * (fromGen + 1),
        index: nodeIndex++
      });
      
      // Add product node (for transition fromGen -> toGen)
      nodes.set(productNodeId, {
        id: productNodeId,
        label: reactionId,
        type: 'reaction',
        subtype: 'product',
        generation: toGen,
        transitionFrom: fromGen,
        val: 1.2,
        coenzyme,
        x: (Math.random() * 150 - 75) * (toGen + 1),
        y: (Math.random() * 150 - 75) * (toGen + 1),
        z: (Math.random() * 150 - 75) * (toGen + 1),
        index: nodeIndex++
      });
      
      // Add dashed line between reactant and product nodes
      links.push({
        source: reactantNodeId,
        target: productNodeId,
        type: 'dashed',
        color: '#b4b4b4',
        opacity: 0.6,
        generation: Math.max(fromGen, toGen),
        transition: `${fromGen}->${toGen}`
      });
      
      // Connect reactant compounds to the reactant node - with color based on generation
      reactantItems.forEach(item => {
        if (nodes.has(item.id)) {
          // We'll set the color when rendering, store the fromGen for coloring
          links.push({
            source: item.id,
            target: reactantNodeId,
            type: 'solid',
            weight: item.coefficient,
            arrows: true,
            // Store generations for coloring instead of fixed color
            sourceGeneration: nodes.get(item.id).generation,
            targetGeneration: fromGen,
            opacity: 0.85,
            generation: fromGen,
            transition: `${fromGen}->${toGen}`
          });
        }
      });
      
      // Connect product node to product compounds - with color based on generation
      productItems.forEach(item => {
        if (nodes.has(item.id)) {
          links.push({
            source: productNodeId,
            target: item.id,
            type: 'solid',
            weight: item.coefficient,
            arrows: true,
            // Store generations for coloring instead of fixed color
            sourceGeneration: toGen,
            targetGeneration: nodes.get(item.id).generation,
            opacity: 0.85,
            generation: toGen,
            transition: `${fromGen}->${toGen}`
          });
        }
      });
      
      // Add EC nodes connected to the reaction
      if (ec_list && ec_list.length > 0) {
        ec_list.forEach(ec => {
          const ecNodeId = `EC_${ec}`;
          
          // Create EC node if it doesn't exist yet
          if (!nodes.has(ecNodeId)) {
            nodes.set(ecNodeId, {
              id: ecNodeId,
              label: ec,
              type: 'ec',
              generation: Math.max(fromGen, toGen),
              val: 1,
              x: (Math.random() * 120 - 60) * Math.max(fromGen, toGen),
              y: (Math.random() * 120 - 60) * Math.max(fromGen, toGen),
              z: (Math.random() * 120 - 60) * Math.max(fromGen, toGen),
              index: nodeIndex++
            });
          }
          
          // Connect EC to reactant node
          links.push({
            source: ecNodeId,
            target: reactantNodeId,
            type: 'dotted',
            color: '#82c8ff',
            opacity: 0.5,
            generation: Math.max(fromGen, toGen),
            transition: `${fromGen}->${toGen}`
          });
          
          // Connect EC to product node
          links.push({
            source: ecNodeId,
            target: productNodeId,
            type: 'dotted',
            color: '#82c8ff',
            opacity: 0.5,
            generation: Math.max(fromGen, toGen),
            transition: `${fromGen}->${toGen}`
          });
        });
      }
    });
    
    return {
      nodes: Array.from(nodes.values()),
      links
    };
  };

  // Filter graph data based on current generation
  const filteredData = useMemo(() => {
    if (!graphData.nodes || !graphData.links) {
      return { nodes: [], links: [] };
    }

    const minVis = minVisibleGeneration || 0;

    // For generation 0, show only compound nodes with generation 0
    if (currentGeneration === 0 && minVis === 0) {
      const filteredNodes = graphData.nodes.filter(
        node => node.type === 'compound' && node.generation === 0
      );
      
      return {
        nodes: filteredNodes,
        links: []
      };
    }
    
    // Filter nodes within the visible generation range [minVis, currentGeneration]
    let nodesForGeneration = graphData.nodes.filter(node => {
      if (node.type === 'compound') return node.generation >= minVis && node.generation <= currentGeneration;
      if (node.type === 'reaction') {
        if (node.subtype === 'reactant') return node.generation >= minVis && node.generation <= currentGeneration;
        if (node.subtype === 'product') return node.generation >= minVis && node.generation <= currentGeneration;
      }
      if (node.type === 'ec') return node.generation >= minVis && node.generation <= currentGeneration;
      return false;
    });
    
    // If hideEC is enabled, filter out EC nodes
    if (hideEC) {
      nodesForGeneration = nodesForGeneration.filter(node => node.type !== 'ec');
    }
    
    // Get IDs of all nodes for this generation
    const nodeIds = new Set(nodesForGeneration.map(node => node.id));
    
    // Filter links within the visible generation range
    const linksForGeneration = graphData.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      return (
        link.generation >= minVis &&
        link.generation <= currentGeneration && 
        nodeIds.has(sourceId) && 
        nodeIds.has(targetId)
      );
    });
    
    return {
      nodes: nodesForGeneration,
      links: linksForGeneration
    };
  }, [graphData, currentGeneration, minVisibleGeneration, hideEC]);

  // =============================================================================
  // Graph Rendering Callbacks
  // =============================================================================

  // Generate node colors based on generation (up to 100 generations)
  const getNodeColor = useCallback((node) => {
    if (node.type === 'ec') return '#92d3ff';
    
    // Define color ranges for generations
    const colors = [
      '#4a9fff', '#5654ff', '#7e51ff', '#a44eff', '#d241ff',
      '#f838e6', '#fc3cbf', '#fe5698', '#ff7771', '#ffb14a',
      '#ffe83c', '#c5f241', '#7ff059', '#39e978', '#00caa8'
    ];
    
    const generationIndex = node.generation % colors.length;
    const base = colors[generationIndex];

    if (!hoverNode) return base;
    if (node.id === hoverNode.id) return base;
    const neigh = neighborsMap.get(hoverNode.id);
    if (neigh && neigh.has(node.id)) return base;
    return dark ? '#2a3342' : '#e5e7eb';
  }, [hoverNode, neighborsMap, dark]);

  // Generate node geometries based on node type
  const getNodeGeometry = useCallback((node) => {
    if (node.type === 'compound') {
      return new THREE.SphereGeometry(node.val);
    } 
    else if (node.type === 'reaction') {
      // Create rounded box for reaction nodes
      const boxGeometry = new THREE.BoxGeometry(node.val * 1.2, node.val * 1.2, node.val * 0.8);
      return boxGeometry;
    } 
    else if (node.type === 'ec') {
      // Create octahedron for EC nodes
      return new THREE.OctahedronGeometry(node.val * 0.8);
    }
    
    return new THREE.SphereGeometry(1);
  }, []);

  // Custom node rendering
  const nodeThreeObject = useCallback((node) => {
    const color = getNodeColor(node);
    const geometry = getNodeGeometry(node);
    
    // Create material based on node type
    let material;
    
    if (node.type === 'compound') {
      material = new THREE.MeshPhongMaterial({ 
        color, 
        transparent: true,
        opacity: 0.85,
        shininess: 90
      });
    } 
    else if (node.type === 'reaction') {
      material = new THREE.MeshPhongMaterial({ 
        color, 
        transparent: true,
        opacity: 0.8,
        shininess: 80
      });
    } 
    else if (node.type === 'ec') {
      material = new THREE.MeshPhongMaterial({ 
        color, 
        transparent: true,
        opacity: 0.7,
        wireframe: true
      });
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Add glowing effect
    const glowMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.15
    });
    
    const glowGeometry = node.type === 'compound' 
      ? new THREE.SphereGeometry(node.val * 1.5)
      : node.type === 'reaction'
        ? new THREE.BoxGeometry(node.val * 1.8, node.val * 1.8, node.val * 1.2)
        : new THREE.OctahedronGeometry(node.val * 1.3);
    
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    mesh.add(glowMesh);
    
    return mesh;
  }, [getNodeColor, getNodeGeometry]);

  // Custom node label rendering
  const nodeThreeObjectExtend = useCallback(() => true, []);

  // Custom node label rendering
  const nodeLabel = useCallback((node) => {
    if (hideLabels) return null;
    
    if (node.type === 'compound') {
      return `${node.label} (${node.generation})`;
    } else if (node.type === 'reaction') {
      const subtype = node.subtype === 'reactant' ? 'R' : 'P';
      return `${node.label} (${subtype})`;
    } else if (node.type === 'ec') {
      return `EC ${node.label}`;
    }
    
    return node.label;
  }, [hideLabels]);

  // Custom link object for arrows
  const linkThreeObject = useCallback((link) => {
    if (!link.arrows) return null;
    
    const size = link.weight || 1;
    const arrowGeometry = new THREE.ConeGeometry(0.5 * size, 1.5 * size, 8);
    
    // Get color based on node generation
    let arrowColor;
    
    // For solid links, generate a gradient color based on source node generation
    if (link.sourceGeneration !== undefined) {
      // Get colors for source generation
      const colors = [
        '#4a9fff', '#5654ff', '#7e51ff', '#a44eff', '#d241ff',
        '#f838e6', '#fc3cbf', '#fe5698', '#ff7771', '#ffb14a',
        '#ffe83c', '#c5f241', '#7ff059', '#39e978', '#00caa8'
      ];
      
      const sourceIndex = link.sourceGeneration % colors.length;
      arrowColor = colors[sourceIndex];
    } else {
      arrowColor = link.color || '#ffffff';
    }
    
    const arrowMaterial = new THREE.MeshBasicMaterial({ 
      color: arrowColor,
      transparent: true,
      opacity: link.opacity || 0.8
    });
    
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.rotation.x = Math.PI / 2;
    
    return arrow;
  }, []);

  // Position the arrow at the middle of the link
  const linkPositionAttribute = useCallback(() => 'center', []);

  // Custom link styling
  const linkDirectionalArrowLength = useCallback((link) => {
    return link.arrows ? 3.5 * (link.weight || 1) : 0;
  }, []);

  const linkWidth = useCallback((link) => {
    return link.weight ? Math.min(link.weight, 4) : 1;
  }, []);

  const linkDirectionalParticles = useCallback((link) => {
    return link.type === 'solid' ? 2 : 0;
  }, []);

  const linkDirectionalParticleWidth = useCallback((link) => {
    return link.weight ? Math.min(link.weight, 3) : 1;
  }, []);

  const linkColor = useCallback((link) => {
    // For dashed and dotted links, use the provided color
    if (link.type === 'dashed' || link.type === 'dotted') {
      if (!hoverNode) return link.color;
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      if (s === hoverNode?.id || t === hoverNode?.id) return link.color;
      return dark ? '#394556' : '#d1d5db';
    }
    
    // For solid links, generate a gradient color based on source and target generations
    if (link.sourceGeneration !== undefined && link.targetGeneration !== undefined) {
      // Get colors for both generations
      const colors = [
        '#4a9fff', '#5654ff', '#7e51ff', '#a44eff', '#d241ff',
        '#f838e6', '#fc3cbf', '#fe5698', '#ff7771', '#ffb14a',
        '#ffe83c', '#c5f241', '#7ff059', '#39e978', '#00caa8'
      ];
      
      const sourceIndex = link.sourceGeneration % colors.length;
      const c = colors[sourceIndex]; // Using source node color for simplicity
      if (!hoverNode) return c;
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      if (s === hoverNode?.id || t === hoverNode?.id) return c;
      return dark ? '#394556' : '#d1d5db';
    }
    
    // Fallback to provided color or default
    if (!hoverNode) return link.color || '#ffffff';
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    if (s === hoverNode?.id || t === hoverNode?.id) return link.color || '#ffffff';
    return dark ? '#394556' : '#d1d5db';
  }, [hoverNode, dark]);

  // =============================================================================
  // Effect Hooks
  // =============================================================================

  // Effect to process results and generate graph data
  useEffect(() => {
    if (!results || results.length === 0) return;
    
    setLoading(true);
    
    // Find min/max generation from compound_generation values
    let maxGen = 0;
    let minGen = Infinity;
    results.forEach(reaction => {
      Object.values(reaction.compound_generation).forEach(gen => {
        if (gen > maxGen) maxGen = gen;
        if (gen < minGen) minGen = gen;
      });
    });
    
    const effectiveMin = Math.max(0, minGen === Infinity ? 0 : minGen);
    setMinGeneration(effectiveMin);
    setMaxGeneration(maxGen);
    setCurrentGeneration(effectiveMin);
    setMinVisibleGeneration(effectiveMin);
    
    // Generate the graph data for all generations
    const { nodes, links } = processGraphData(results);
    
    setGraphData({ nodes, links });
    setLoading(false);
    
    // Initialize force graph with a timeout to ensure it's mounted
    setTimeout(() => {
      if (fgRef.current) {
        // Ensure simulation and forces are properly initialized
        if (fgRef.current.d3Force('charge')) {
          fgRef.current.d3Force('charge').strength(-repulsion);
        }
        
        if (fgRef.current.d3Force('link')) {
          fgRef.current.d3Force('link').distance(link => {
            const base = linkDistance;
            return link.type === 'dashed' ? base * 1.6 : (link.type === 'dotted' ? base * 1.2 : base);
          });
        }
        
        // Reheat the simulation
        fgRef.current.d3ReheatSimulation();
      }
    }, 300);
  }, [results]);

  // Apply different layout algorithms
  useEffect(() => {
    if (!fgRef.current) return;
    
    // Wait a bit to ensure graph is initialized
    setTimeout(() => {
      if (layoutMode === 'tornado') {
        // Apply spiral layout
        if (fgRef.current.d3Force('charge')) {
          fgRef.current.d3Force('charge', null);
        }
        if (fgRef.current.d3Force('link')) {
          fgRef.current.d3Force('link', null);
        }
        if (fgRef.current.d3Force('center')) {
          fgRef.current.d3Force('center', null);
        }
        
        const nodes = graphData.nodes;
        const spiral = d3Force => {
          const alpha = 0.1;
          nodes.forEach(node => {
            if (!node.x || !node.y || !node.z) return;
            
            const angle = 0.4 * node.generation;
            const radius = 20 + 10 * node.generation;
            const targetX = radius * Math.cos(angle);
            const targetY = radius * Math.sin(angle);
            const targetZ = 5 * node.generation;
            
            node.vx += (targetX - node.x) * alpha;
            node.vy += (targetY - node.y) * alpha;
            node.vz += (targetZ - node.z) * alpha;
          });
        };
        
        fgRef.current.d3Force('spiral', spiral);
      } 
      else if (layoutMode === 'globe') {
        // Apply globe layout
        if (fgRef.current.d3Force('charge')) {
          fgRef.current.d3Force('charge', null);
        }
        if (fgRef.current.d3Force('link')) {
          fgRef.current.d3Force('link', null);
        }
        if (fgRef.current.d3Force('center')) {
          fgRef.current.d3Force('center', null);
        }
        
        const nodes = graphData.nodes;
        const globe = d3Force => {
          const alpha = 0.1;
          nodes.forEach((node, i) => {
            if (!node.x || !node.y || !node.z) return;
            
            const radius = 50 + 15 * node.generation;
            const phi = Math.acos(-1 + (2 * (i % 100)) / Math.min(nodes.length, 100));
            const theta = Math.sqrt(Math.min(nodes.length, 100) * Math.PI) * phi;
            
            const targetX = radius * Math.sin(phi) * Math.cos(theta);
            const targetY = radius * Math.sin(phi) * Math.sin(theta);
            const targetZ = radius * Math.cos(phi);
            
            node.vx += (targetX - node.x) * alpha;
            node.vy += (targetY - node.y) * alpha;
            node.vz += (targetZ - node.z) * alpha;
          });
        };
        
        fgRef.current.d3Force('globe', globe);
      } 
      else {
        // Reset to force-directed layout
        if (fgRef.current.d3Force('spiral')) {
          fgRef.current.d3Force('spiral', null);
        }
        if (fgRef.current.d3Force('globe')) {
          fgRef.current.d3Force('globe', null);
        }
        
        if (!fgRef.current.d3Force('charge')) {
          fgRef.current.d3Force('charge', d3.forceManyBody().strength(-repulsion));
        } else {
          fgRef.current.d3Force('charge').strength(-repulsion);
        }
        
        if (!fgRef.current.d3Force('link')) {
          fgRef.current.d3Force('link', d3.forceLink().distance(link => {
            const base = linkDistance;
            return link.type === 'dashed' ? base * 1.6 : (link.type === 'dotted' ? base * 1.2 : base);
          }));
        } else {
          fgRef.current.d3Force('link').distance(link => {
            const base = linkDistance;
            return link.type === 'dashed' ? base * 1.6 : (link.type === 'dotted' ? base * 1.2 : base);
          });
        }
        
        if (!fgRef.current.d3Force('center')) {
          fgRef.current.d3Force('center', d3.forceCenter());
        }
      }
      
      // Reheat simulation
      fgRef.current.d3ReheatSimulation();
    }, 300);
    
  }, [layoutMode, graphData.nodes, repulsion, linkDistance]);

  // Update forces if physics sliders change while in force layout
  useEffect(() => {
    if (!fgRef.current) return;
    if (layoutMode !== 'force') return;
    if (fgRef.current.d3Force('charge')) {
      fgRef.current.d3Force('charge').strength(-repulsion);
    }
    if (fgRef.current.d3Force('link')) {
      fgRef.current.d3Force('link').distance(link => {
        const base = linkDistance;
        return link.type === 'dashed' ? base * 1.6 : (link.type === 'dotted' ? base * 1.2 : base);
      });
    }
    fgRef.current.d3ReheatSimulation();
  }, [repulsion, linkDistance, layoutMode]);

  // Build neighbors map for hover highlighting based on currently filtered data
  useEffect(() => {
    const map = new Map();
    filteredData.links.forEach((l) => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (!map.has(s)) map.set(s, new Set());
      if (!map.has(t)) map.set(t, new Set());
      map.get(s).add(t);
      map.get(t).add(s);
    });
    setNeighborsMap(map);
  }, [filteredData]);

  // Dynamically update node mesh colors on hover for highlight/dimming
  useEffect(() => {
    const api = fgRef.current;
    if (!api) return;
    const dataGetter = api.graphData;
    const data = typeof dataGetter === 'function' ? dataGetter() : dataGetter;
    const nodesArr = (data && data.nodes) ? data.nodes : [];
    nodesArr.forEach((n) => {
      const mesh = n.__threeObj;
      if (!mesh || !mesh.material) return;
      const color = getNodeColor(n);
      if (mesh.material.color) {
        mesh.material.color.set(color);
      }
      // Update glow child if present
      if (mesh.children && mesh.children[0] && mesh.children[0].material && mesh.children[0].material.color) {
        mesh.children[0].material.color.set(color);
      }
    });
    api.refresh?.();
  }, [hoverNode, neighborsMap, dark, getNodeColor]);

  // Effect to handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (isFullscreen && fgRef.current) {
        const refObj = fgRef.current;
        // Some versions expose width/height as setter functions, others as props
        if (typeof refObj.width === 'function') {
          refObj.width(window.innerWidth);
        } else {
          refObj.width = window.innerWidth;
        }

        if (typeof refObj.height === 'function') {
          refObj.height(window.innerHeight);
        } else {
          refObj.height = window.innerHeight;
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isFullscreen]);

  // Effect for the fullscreen change event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Effect to clean up rotation interval on unmount
  useEffect(() => {
    return () => {
      // Clear any running rotation intervals
      clearInterval(window.axisRotationInterval);
      
      // Clear play interval if running
      if (playInterval) {
        clearInterval(playInterval);
      }
    };
  }, [playInterval]);

  // Effect to adjust graph size immediately when fullscreen toggles
  useEffect(() => {
    if (!fgRef.current) return;
    const updateDims = () => {
      const w = isFullscreen ? window.innerWidth : containerRef.current?.clientWidth || 800;
      const h = isFullscreen ? window.innerHeight : (typeof height === 'string' ? parseInt(height) : height);
      // API differences – width/height may be getter/setter fn or prop
      if (typeof fgRef.current.width === 'function') {
        fgRef.current.width(w);
      } else {
        fgRef.current.width = w;
      }
      if (typeof fgRef.current.height === 'function') {
        fgRef.current.height(h);
      } else {
        fgRef.current.height = h;
      }
      fgRef.current.refresh?.();
    };
    updateDims();
  }, [isFullscreen]);

  /* ------------------------------------------------------------------ */
  /* Spherical grid overlay (concave, follows theme)                    */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!fgRef.current) return;

    const scene = fgRef.current.scene();
    if (!scene) return;

    // Remove previous grid if present (e.g., theme changed or graph resized)
    const existing = scene.getObjectByName('concaveGrid');
    if (existing) scene.remove(existing);

    if (!showGrid) return; // don't add if toggled off

    // Use a very large radius so users never "reach" the sphere boundary
    const radius = 100000; // effectively infinite for interactive purposes

    // Build wireframe sphere
    const segments = 32;
    const rings = 24;
    const sphereGeom = new THREE.SphereGeometry(radius, segments, rings);
    const wireGeom = new THREE.WireframeGeometry(sphereGeom);
    const material = new THREE.LineBasicMaterial({
      color: dark ? 0xffffff : 0x000000,
      transparent: true,
      opacity: 0.07
    });
    const grid = new THREE.LineSegments(wireGeom, material);
    grid.name = 'concaveGrid';
    grid.scale.set(-1, 1, 1); // flip so lines are rendered from inside the sphere
    grid.renderOrder = -1; // ensure drawn behind nodes
    scene.add(grid);

    // Cleanup when component unmounts or dependencies change
    return () => {
      scene.remove(grid);
    };
  }, [dark, showGrid, graphData]);

  // =============================================================================
  // User Interaction Functions
  // =============================================================================

  // Play/pause controls for generational animation
  const togglePlay = () => {
    if (isPlaying) {
      clearInterval(playInterval);
      setPlayInterval(null);
      setIsPlaying(false);
    } else {
      const interval = setInterval(() => {
        setCurrentGeneration(gen => {
          if (gen < maxGeneration) return gen + 1;
          clearInterval(interval);
          setIsPlaying(false);
          setPlayInterval(null);
          return gen;
        });
      }, Math.max(200, playSpeed));
      
      setPlayInterval(interval);
      setIsPlaying(true);
    }
  };

  // Step forward one generation
  const stepForward = () => {
    if (currentGeneration < maxGeneration) {
      setCurrentGeneration(currentGeneration + 1);
    }
  };

  // Step backward one generation — drag minVisibleGeneration down if needed
  const stepBackward = () => {
    if (currentGeneration > minGeneration) {
      const next = currentGeneration - 1;
      setCurrentGeneration(next);
      if (minVisibleGeneration > next) setMinVisibleGeneration(next);
    }
  };

  const dispatchResize = () => window.dispatchEvent(new Event('resize'));

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
          dispatchResize();
        })
        .catch(err => console.error(`Error attempting to enable fullscreen: ${err.message}`));
    } else {
      document.exitFullscreen()
        .then(() => {
          setIsFullscreen(false);
          dispatchResize();
        })
        .catch(() => {
          setIsFullscreen(false);
          dispatchResize();
        });
    }
  };
  
  // Toggle node positions locked/unlocked
  const toggleNodesLocked = () => {
    setNodesLocked(!nodesLocked);
    
    if (fgRef.current) {
      const getGraphData = () => {
        const dataGetter = fgRef.current.graphData;
        return typeof dataGetter === 'function' ? dataGetter() : dataGetter || { nodes: [], links: [] };
      };
      // If locking nodes, simply freeze the simulation in place
      if (!nodesLocked) {
        // Stop simulation completely
        const gd = getGraphData();
        if (gd && gd.nodes && gd.nodes.length > 0) {
          // Fix nodes in their current positions
          gd.nodes.forEach(node => {
            node.fx = node.x;
            node.fy = node.y;
            node.fz = node.z;
          });
          fgRef.current.refresh();
        }
      } else {
        // Unfreeze nodes - remove fixed positions
        const gd2 = getGraphData();
        if (gd2 && gd2.nodes && gd2.nodes.length > 0) {
          gd2.nodes.forEach(node => {
            node.fx = undefined;
            node.fy = undefined;
            node.fz = undefined;
          });
          fgRef.current.refresh();
          fgRef.current.d3ReheatSimulation();
        }
      }
    }
  };
  
  // Handle axis rotations
  const handleAxisControl = (axis, direction) => {
    if (!fgRef.current) return;
    
    // Get current camera position
    const camera = fgRef.current.camera();
    const controls = fgRef.current.controls();
    
    if (axis === 'center') {
      // Center and fit all objects in view
      const getGraphData = () => {
        const dataGetter = fgRef.current.graphData;
        return typeof dataGetter === 'function' ? dataGetter() : dataGetter || { nodes: [], links: [] };
      };
      const gd = getGraphData();
      if (gd && gd.nodes && gd.nodes.length > 0) {
        // Calculate the bounding box of all nodes
        const box = new THREE.Box3();
        
        gd.nodes.forEach(node => {
          if (node.x !== undefined && node.y !== undefined && node.z !== undefined) {
            box.expandByPoint(new THREE.Vector3(node.x, node.y, node.z));
          }
        });
        
        // Ensure box is not empty or invalid
        if (box.min.x !== Infinity && box.max.x !== -Infinity) {
          const center = new THREE.Vector3();
          box.getCenter(center);
          
          // Get the size of the box
          const size = new THREE.Vector3();
          box.getSize(size);
          
          // Calculate distance needed to fit the entire box
          const maxDim = Math.max(size.x, size.y, size.z);
          const fitHeightDistance = maxDim / (2 * Math.atan(Math.PI * camera.fov / 360));
          const fitWidthDistance = fitHeightDistance / camera.aspect;
          const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.2; // Add 20% margin
          
          // Set the camera position
          const direction = camera.position.clone().sub(controls.target).normalize().multiplyScalar(distance);
          camera.position.copy(center.clone().add(direction));
          controls.target.copy(center);
          
          // Update controls
          controls.update();
        }
      }
      return;
    }
    
    // Set up rotation interval for continuous rotation while button is held
    clearInterval(window.axisRotationInterval);
    
    // Define rotation amounts
    const rotationAmount = direction === 'pos' ? Math.PI/60 : -Math.PI/60;
    
    // Create rotation function
    const rotateOnAxis = () => {
      // Apply rotation based on axis
      switch(axis) {
        case 'x':
          camera.position.y = camera.position.y * Math.cos(rotationAmount) - camera.position.z * Math.sin(rotationAmount);
          camera.position.z = camera.position.y * Math.sin(rotationAmount) + camera.position.z * Math.cos(rotationAmount);
          break;
        case 'y':
          camera.position.x = camera.position.x * Math.cos(rotationAmount) + camera.position.z * Math.sin(rotationAmount);
          camera.position.z = -camera.position.x * Math.sin(rotationAmount) + camera.position.z * Math.cos(rotationAmount);
          break;
        case 'z':
          camera.position.x = camera.position.x * Math.cos(rotationAmount) - camera.position.y * Math.sin(rotationAmount);
          camera.position.y = camera.position.x * Math.sin(rotationAmount) + camera.position.y * Math.cos(rotationAmount);
          break;
      }
      
      controls.update();
    };
    
    // Start the rotation
    rotateOnAxis(); // Execute once immediately
    
    // Set up interval for continuous rotation
    window.axisRotationInterval = setInterval(rotateOnAxis, 16); // ~60fps
  };
  
  // Handle rotation stop when button is released
  const handleAxisControlEnd = () => {
    clearInterval(window.axisRotationInterval);
  };
  
  // Handle node click to show details
  const handleNodeClick = async (node) => {
    setSelectedNode(node);
    setNodeInfoVisible(true);
    setIsLoading(true);
    
    // Determine node type and ID for API call
    let nodeType, nodeId;
    
    if (node.type === 'compound') {
      nodeType = 'compound';
      nodeId = node.id;
    } else if (node.type === 'reaction') {
      nodeType = 'reaction';
      nodeId = node.label; // Use the label which is the reaction ID without _reactant/_product
    } else if (node.type === 'ec') {
      nodeType = 'ec';
      nodeId = node.label; // EC number
    }
    
    // Calculate node connections (degree)
    const nodeConnections = calculateNodeConnections(node);
    
    
    const nodeData = {
      basic: {
        id: node.id,
        type: node.type,
        subtype: node.subtype,
        generation: node.generation,
        connections: nodeConnections
      }
    };
    
    // Make API call if node type is valid
    if (nodeType && nodeId) {
      try {
        const apiData = await fetchNodeData(nodeType, nodeId);
        if (apiData && apiData.data) {
          nodeData.api = apiData.data;
        }
      } catch (error) {
        console.error(`Error fetching data for ${nodeType} ${nodeId}:`, error);
      }
    }
    
    setNodeApiData(nodeData);
    setIsLoading(false);
  };
  
  // New: keep node fixed after dragging, mimicking 2D viewer behaviour
  const handleNodeDragEnd = (node) => {
    if (!node) return;
    node.fx = node.x;
    node.fy = node.y;
    node.fz = node.z;
  };
  
  // Calculate node connections (degree)
  const calculateNodeConnections = (node) => {
    if (!graphData.links) return 0;
    
    // Count links connected to this node
    let connections = graphData.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return sourceId === node.id || targetId === node.id;
    }).length;
    
    // Apply special calculation rules
    if (node.type === 'ec') {
      // Divide by 2 for EC nodes as mentioned
      connections = Math.floor(connections / 2);
    } else if (node.type === 'reaction') {
      // Don't count dashed edges for reaction nodes
      const dashedConnections = graphData.links.filter(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        return (sourceId === node.id || targetId === node.id) && link.type === 'dashed';
      }).length;
      
      connections -= dashedConnections;
    }
    
    return connections;
  };

  // Zoom helpers
  const zoom = (factor) => {
    if (!fgRef.current) return;
    const camera = fgRef.current.camera();
    const controls = fgRef.current.controls();
    const offset = camera.position.clone().sub(controls.target);
    offset.multiplyScalar(factor);
    camera.position.copy(controls.target.clone().add(offset));
    controls.update();
  };
  const handleZoomIn = () => zoom(0.9);
  const handleZoomOut = () => zoom(1.1);

  const handleDownloadPNG = () => {
    if (!fgRef.current) return;
    const renderer = fgRef.current.renderer?.();
    const canvas = renderer?.domElement;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'network-3d.png';
    a.click();
  };

  const fitToView = () => handleAxisControl('center');

  // Hold-to-rotate camera, similar to 2D rotate controls
  const startRotate = () => {
    if (!fgRef.current) return;
    if (rotateIntervalRef.current) {
      clearInterval(rotateIntervalRef.current);
      rotateIntervalRef.current = null;
    }
    const step = () => {
      const camera = fgRef.current.camera();
      const controls = fgRef.current.controls();
      const offset = camera.position.clone().sub(controls.target);
      const radius = Math.sqrt(offset.x*offset.x + offset.z*offset.z);
      const theta = Math.atan2(offset.x, offset.z) + (Math.PI/90); // faster than auto-rotate
      const y = offset.y;
      camera.position.x = controls.target.x + radius * Math.sin(theta);
      camera.position.z = controls.target.z + radius * Math.cos(theta);
      camera.position.y = controls.target.y + y;
      controls.update();
    };
    rotateIntervalRef.current = setInterval(step, 30);
  };
  const stopRotate = () => {
    if (rotateIntervalRef.current) {
      clearInterval(rotateIntervalRef.current);
      rotateIntervalRef.current = null;
    }
  };

  // Auto-rotate
  useEffect(() => {
    if (!autoRotate) {
      if (rotateIntervalRef.current) {
        clearInterval(rotateIntervalRef.current);
        rotateIntervalRef.current = null;
      }
      return;
    }
    if (!fgRef.current) return;
    const step = () => {
      const camera = fgRef.current.camera();
      const controls = fgRef.current.controls();
      const offset = camera.position.clone().sub(controls.target);
      const radius = Math.sqrt(offset.x*offset.x + offset.z*offset.z);
      const theta = Math.atan2(offset.x, offset.z) + (Math.PI/360); // slow rotation
      const y = offset.y; // keep current height
      camera.position.x = controls.target.x + radius * Math.sin(theta);
      camera.position.z = controls.target.z + radius * Math.cos(theta);
      camera.position.y = controls.target.y + y;
      controls.update();
    };
    rotateIntervalRef.current = setInterval(step, 30);
    return () => {
      if (rotateIntervalRef.current) clearInterval(rotateIntervalRef.current);
      rotateIntervalRef.current = null;
    };
  }, [autoRotate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey) return;
      switch (e.key) {
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
        case '_':
          handleZoomOut();
          break;
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          stepForward();
          break;
        case 'ArrowLeft':
          stepBackward();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'h':
        case 'H':
          setShowHelp(v => !v);
          break;
        case 'r':
        case 'R':
          setAutoRotate(v => !v);
          break;
        case '0':
          fitToView();
          break;
        case 'o':
        case 'O':
          setShowGrid(v => !v);
          break;
        case 's':
        case 'S':
          handleDownloadPNG();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, stepForward, stepBackward]);

  // Visibility accessors to robustly hide EC nodes/links
  const nodeVisible = useCallback((node) => {
    if (!hideEC) return true;
    return node.type !== 'ec' && !String(node.id || '').startsWith('EC_');
  }, [hideEC]);

  const linkVisible = useCallback((link) => {
    if (!hideEC) return true;
    const getId = (end) => (typeof end === 'object' ? end.id : end);
    const getType = (end) => (typeof end === 'object' ? end.type : undefined);
    const sId = getId(link.source);
    const tId = getId(link.target);
    const sType = getType(link.source);
    const tType = getType(link.target);
    const sIsEc = sType === 'ec' || String(sId || '').startsWith('EC_');
    const tIsEc = tType === 'ec' || String(tId || '').startsWith('EC_');
    return !(sIsEc || tIsEc);
  }, [hideEC]);

  // =============================================================================
  // UI Component Rendering
  // =============================================================================

  // Control panel UI
  const renderControlPanel = () => (
    <ControlPanel $dark={dark}>
      <SliderContainer>
        <SliderLabel>
          <span>Generation (To)</span>
          <span>{currentGeneration} / {maxGeneration}</span>
        </SliderLabel>
        <Slider
          type="range"
          min={minGeneration}
          max={maxGeneration}
          value={currentGeneration}
          onChange={e => {
            const val = parseInt(e.target.value);
            setCurrentGeneration(val);
            if (minVisibleGeneration > val) setMinVisibleGeneration(val);
          }}
        />
      </SliderContainer>

      <SliderContainer>
        <SliderLabel>
          <span>Generation (From)</span>
          <span>{minVisibleGeneration} / {currentGeneration}</span>
        </SliderLabel>
        <Slider
          type="range"
          min={minGeneration}
          max={currentGeneration}
          value={minVisibleGeneration}
          onChange={e => setMinVisibleGeneration(parseInt(e.target.value))}
        />
      </SliderContainer>

      <SliderContainer>
        <SliderLabel>
          <span>Play Speed (ms)</span>
          <span>{playSpeed}</span>
        </SliderLabel>
        <Slider
          type="range"
          min={200}
          max={3000}
          step={100}
          value={playSpeed}
          onChange={e => setPlaySpeed(parseInt(e.target.value))}
        />
      </SliderContainer>
      
      <ButtonGroup>
        <Button 
          onClick={stepBackward}
          disabled={currentGeneration === minGeneration}
          $iconOnly={true}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.5 7.5a.5.5 0 0 1 0 1H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5z"/>
          </svg>
        </Button>
        
        <Button 
          onClick={togglePlay}
          $active={isPlaying}
        >
          {isPlaying ? (
            <><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
            </svg> Pause</>
          ) : (
            <><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696L11.596 8.697a.802.802 0 0 1 0 1.393z"/>
            </svg> Play</>
          )}
        </Button>
        
        <Button 
          onClick={stepForward}
          disabled={currentGeneration === maxGeneration}
          $iconOnly={true}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm3.5 7.5a.5.5 0 0 1 0 1H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5z"/>
          </svg>
        </Button>
      </ButtonGroup>
    </ControlPanel>
  );

  // Options panel UI
  const renderOptionsPanel = () => (
    <OptionsPanel $dark={dark}>
      <Option>
        <OptionLabel htmlFor="hideLabels">Hide Labels</OptionLabel>
        <Toggle>
          <ToggleInput 
            id="hideLabels"
            type="checkbox" 
            checked={hideLabels}
            onChange={() => setHideLabels(!hideLabels)}
          />
          <ToggleSlider />
        </Toggle>
      </Option>
      
      <Option>
        <OptionLabel htmlFor="hideEC">Hide EC Nodes</OptionLabel>
        <Toggle>
          <ToggleInput 
            id="hideEC"
            type="checkbox" 
            checked={hideEC}
            onChange={() => setHideEC(!hideEC)}
          />
          <ToggleSlider />
        </Toggle>
      </Option>

      <Option>
        <OptionLabel htmlFor="showGrid">Show Grid</OptionLabel>
        <Toggle>
          <ToggleInput
            id="showGrid"
            type="checkbox"
            checked={showGrid}
            onChange={() => setShowGrid(v => !v)}
          />
          <ToggleSlider />
        </Toggle>
      </Option>
      
      <Option>
        <OptionLabel htmlFor="layoutMode">Layout</OptionLabel>
        <Select 
          id="layoutMode"
          value={layoutMode}
          onChange={e => setLayoutMode(e.target.value)}
        >
          <option value="force">Force-Directed</option>
          <option value="tornado">Tornado (Spiral)</option>
          <option value="globe">Globe (Atomic)</option>
        </Select>
      </Option>

      {layoutMode === 'force' && (
        <>
          <Option>
            <OptionLabel>Repulsion</OptionLabel>
            <Slider
              type="range"
              min={0}
              max={800}
              step={10}
              value={repulsion}
              onChange={e => setRepulsion(parseInt(e.target.value))}
            />
          </Option>
          <Option>
            <OptionLabel>Link Distance</OptionLabel>
            <Slider
              type="range"
              min={20}
              max={160}
              step={5}
              value={linkDistance}
              onChange={e => setLinkDistance(parseInt(e.target.value))}
            />
          </Option>
        </>
      )}
    </OptionsPanel>
  );

  // =============================================================================
  // Main Render
  // =============================================================================

  // Render node info panel
  const renderNodeInfoPanel = () => {
    if (!selectedNode || !nodeApiData) return null;
    
    return (
      <NodeInfoPanel $visible={nodeInfoVisible}>
        <CloseButton onClick={() => setNodeInfoVisible(false)}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </CloseButton>
        
        <NodeInfoTitle>
          {selectedNode.type === 'compound' ? 'Compound' : 
           selectedNode.type === 'reaction' ? 'Reaction' : 'EC'} Details
        </NodeInfoTitle>
        
        <NodeInfoSection>
          <NodeInfoSectionTitle>Basic Information</NodeInfoSectionTitle>
          <NodeInfoTable>
            <tbody>
              <tr>
                <td>ID</td>
                <td>{selectedNode.id}</td>
              </tr>
              <tr>
                <td>Type</td>
                <td>{selectedNode.type}{selectedNode.subtype ? ` (${selectedNode.subtype})` : ''}</td>
              </tr>
              <tr>
                <td>Generation</td>
                <td>{selectedNode.generation}</td>
              </tr>
              <tr>
                <td>Connections</td>
                <td>{nodeApiData.basic.connections}</td>
              </tr>
              {selectedNode.coenzyme && (
                <tr>
                  <td>Coenzyme</td>
                  <td>{selectedNode.coenzyme}</td>
                </tr>
              )}
            </tbody>
          </NodeInfoTable>
        </NodeInfoSection>
        
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
            <Spinner style={{ width: '30px', height: '30px' }} />
          </div>
        ) : nodeApiData.api ? (
          <NodeInfoSection>
            <NodeInfoSectionTitle>API Data</NodeInfoSectionTitle>
            {selectedNode.type === 'compound' && (
              <NodeInfoTable>
                <tbody>
                  <tr>
                    <td>Name</td>
                    <td>{nodeApiData.api.name}</td>
                  </tr>
                  <tr>
                    <td>Formula</td>
                    <td>{nodeApiData.api.formula}</td>
                  </tr>
                  <tr>
                    <td>Exact Mass</td>
                    <td>{nodeApiData.api.exact_mass}</td>
                  </tr>
                  <tr>
                    <td>Molecular Weight</td>
                    <td>{nodeApiData.api.mol_weight}</td>
                  </tr>
                </tbody>
              </NodeInfoTable>
            )}
            
            {selectedNode.type === 'reaction' && (
              <NodeInfoTable>
                <tbody>
                  <tr>
                    <td>Definition</td>
                    <td>{nodeApiData.api.definition}</td>
                  </tr>
                </tbody>
              </NodeInfoTable>
            )}
            
            {selectedNode.type === 'ec' && Array.isArray(nodeApiData.api) && (
              <NodeInfoPre>
                {JSON.stringify(nodeApiData.api, null, 2)}
              </NodeInfoPre>
            )}
          </NodeInfoSection>
        ) : (
          <NodeInfoSection>
            <p style={{ color: '#abb4c5', fontSize: '13px' }}>No additional data available</p>
          </NodeInfoSection>
        )}
      </NodeInfoPanel>
    );
  };

  // Expose imperative functions for saving/restoring node positions
  useImperativeHandle(ref, () => ({
    getNodePositions: () => {
      if (!fgRef.current) return {};
      const dataGetter = fgRef.current.graphData;
      const data = typeof dataGetter === 'function' ? dataGetter() : dataGetter;
      const nodesArr = (data && data.nodes) ? data.nodes : [];
      const positions = {};
      nodesArr.forEach((n) => {
        positions[n.id] = { x: n.x, y: n.y, z: n.z };
      });
      return positions;
    },
    setNodePositions: (positions) => {
      if (!positions || !fgRef.current) return;
      const dataGetter = fgRef.current.graphData;
      const data = typeof dataGetter === 'function' ? dataGetter() : dataGetter;
      const nodesArr = (data && data.nodes) ? data.nodes : [];
      nodesArr.forEach((n) => {
        const pos = positions[n.id];
        if (pos) {
          n.x = pos.x;
          n.y = pos.y;
          n.z = pos.z;
          n.fx = pos.x;
          n.fy = pos.y;
          n.fz = pos.z;
        }
      });
      if (typeof fgRef.current.refresh === 'function') {
        fgRef.current.refresh();
      }
    },
  }));

  return (
    <Container ref={containerRef} style={{ width: '100%', height: '100%' }}>
      
      {filteredData.nodes.length > 0 ? (
        <ForceGraph3D
          ref={fgRef}
          graphData={filteredData}
          nodeThreeObject={nodeThreeObject}
          nodeThreeObjectExtend={nodeThreeObjectExtend}
          nodeColor={getNodeColor}
          nodeLabel={nodeLabel}
          nodeRelSize={2}
          linkThreeObject={linkThreeObject}
          linkPositionAttribute={linkPositionAttribute}
          linkWidth={linkWidth}
          linkDirectionalParticles={linkDirectionalParticles}
          linkDirectionalParticleWidth={linkDirectionalParticleWidth}
          linkDirectionalArrowLength={linkDirectionalArrowLength}
          linkColor={linkColor}
          linkOpacity={0.8}
          backgroundColor={dark ? "#1a2130" : "#FFFFFF"}
          linkDirectionalParticleSpeed={0.1}
          linkCurvature={link => link.type === 'dashed' ? 0.3 : 0}
          enableNodeDrag={!nodesLocked}
          enableNavigationControls={true}
          showNavInfo={false}
          controlType="orbit"
          warmupTicks={500}
          cooldownTicks={500}
          cooldownTime={8000}
          width={isFullscreen ? window.innerWidth : undefined}
          height={isFullscreen ? window.innerHeight : undefined}
          onNodeClick={handleNodeClick}
          onNodeDragEnd={handleNodeDragEnd}
          onNodeHover={(n) => setHoverNode(n || null)}
          onLinkHover={(l) => setHoverLink(l || null)}
          onEngineStop={() => {}}
        />
      ) : (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          width: '100%', height: '100%',
          backgroundColor: dark ? '#1a2130' : '#FFFFFF',
          color: dark ? '#abb4c5' : '#64748b',
          fontSize: '14px',
        }}>
          Initializing 3D graph…
        </div>
      )}

      {showOptions && renderOptionsPanel()}
      
      {renderNodeInfoPanel()}
      
      <LoadingOverlay $loading={loading}>
        <Spinner />
        <div>Loading Network Data...</div>
      </LoadingOverlay>

      {/* Search bar */}
      <SearchContainer $dark={dark}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <SearchInput
          $dark={dark}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search node by ID..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const q = searchQuery.trim();
              if (!q) return;
              const nodes = filteredData.nodes;
              let target = nodes.find(n => n.id === q) || nodes.find(n => String(n.id).startsWith(q)) || nodes.find(n => String(n.id).includes(q));
              if (!target) return;
              const lookAt = { x: target.x || 0, y: target.y || 0, z: target.z || 0 };
              const distance = 80;
              const dest = { x: lookAt.x + distance, y: lookAt.y + distance, z: lookAt.z + distance };
              const api = fgRef.current;
              if (api && typeof api.cameraPosition === 'function') {
                api.cameraPosition(dest, lookAt, 1500);
              } else if (api) {
                const camera = api.camera();
                const controls = api.controls();
                camera.position.set(dest.x, dest.y, dest.z);
                controls.target.set(lookAt.x, lookAt.y, lookAt.z);
                controls.update();
              }
              setHoverNode(target);
            }
          }}
        />
        <SearchBtn $dark={dark} onClick={() => {
          const q = searchQuery.trim();
          if (!q) return;
          const nodes = filteredData.nodes;
          let target = nodes.find(n => n.id === q) || nodes.find(n => String(n.id).startsWith(q)) || nodes.find(n => String(n.id).includes(q));
          if (!target) return;
          const lookAt = { x: target.x || 0, y: target.y || 0, z: target.z || 0 };
          const distance = 80;
          const dest = { x: lookAt.x + distance, y: lookAt.y + distance, z: lookAt.z + distance };
          const api = fgRef.current;
          if (api && typeof api.cameraPosition === 'function') {
            api.cameraPosition(dest, lookAt, 1500);
          } else if (api) {
            const camera = api.camera();
            const controls = api.controls();
            camera.position.set(dest.x, dest.y, dest.z);
            controls.target.set(lookAt.x, lookAt.y, lookAt.z);
            controls.update();
          }
          setHoverNode(target);
        }}>Go</SearchBtn>
      </SearchContainer>

      {/* 2D-style generation seek bar and toolbar */}
      <GenerationControls
        currentGeneration={currentGeneration}
        setCurrentGeneration={setCurrentGeneration}
        maxGeneration={maxGeneration}
        minGeneration={minGeneration}
        minVisibleGeneration={minVisibleGeneration}
        setMinVisibleGeneration={setMinVisibleGeneration}
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        stepForward={stepForward}
        stepBackward={stepBackward}
        transitionSpeed={transitionSpeed}
        setTransitionSpeed={setTransitionSpeed}
        isFullscreen={isFullscreen}
        handleZoomIn={handleZoomIn}
        handleZoomOut={handleZoomOut}
        resetSpiral={fitToView}
        toggleFullscreen={toggleFullscreen}
        handleDownloadSVG={handleDownloadPNG}
        togglePhysics={() => setShowOptions(v => !v)}
        toggleHelp={() => setShowHelp(v => !v)}
        startRotate={startRotate}
        stopRotate={stopRotate}
        togglePhysicsSim={toggleNodesLocked}
        physicsOff={nodesLocked}
        toggleOverlay={() => setShowGrid(v => !v)}
        overlayOn={showGrid}
      />
      
      {/* Help overlay */}
      <HelpOverlayBackdrop $visible={showHelp} onClick={() => setShowHelp(false)}>
        <HelpOverlayCard $dark={dark} onClick={e => e.stopPropagation()}>
          <HelpTitle $dark={dark}>Keyboard Shortcuts</HelpTitle>
          <HelpList>
            <li><HelpKey $dark={dark}>+</HelpKey>Zoom In</li>
            <li><HelpKey $dark={dark}>-</HelpKey>Zoom Out</li>
            <li><HelpKey $dark={dark}>Space</HelpKey>Play/Pause generations</li>
            <li><HelpKey $dark={dark}>←</HelpKey>Step Back</li>
            <li><HelpKey $dark={dark}>→</HelpKey>Step Forward</li>
            <li><HelpKey $dark={dark}>F</HelpKey>Toggle Fullscreen</li>
            <li><HelpKey $dark={dark}>R</HelpKey>Toggle Auto-Rotate</li>
            <li><HelpKey $dark={dark}>0</HelpKey>Fit To View</li>
            <li><HelpKey $dark={dark}>O</HelpKey>Toggle Grid</li>
            <li><HelpKey $dark={dark}>S</HelpKey>Download PNG</li>
          </HelpList>
        </HelpOverlayCard>
      </HelpOverlayBackdrop>
    </Container>
  );
});

// =============================================================================
// Container Component
// =============================================================================

const NetworkViewerContainer = forwardRef(({ results, height }, ref) => {
  const innerRef = useRef();

  // Expose imperative API by delegating to the inner 3D viewer
  useImperativeHandle(ref, () => ({
    getNodePositions: () => innerRef.current?.getNodePositions?.(),
    setNodePositions: (positions) => innerRef.current?.setNodePositions?.(positions),
  }));

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {results && results.length > 0 ? (
        <NetworkViewer3D ref={innerRef} results={results} height={height} />
      ) : (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100%',
          backgroundColor: '#121820',
          color: '#abb4c5',
          borderRadius: '8px'
        }}>
          No data available. Please select a reaction network.
        </div>
      )}
    </div>
  );
});

export default NetworkViewerContainer;