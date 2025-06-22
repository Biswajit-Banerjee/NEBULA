import React, { useState, useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import styled from 'styled-components';
import * as d3 from 'd3';
import { forwardRef as forwardRefReact, useRef as useRefReact } from 'react';

// =============================================================================
// Styled Components
// =============================================================================

// API fetch function
const fetchNodeData = async (nodeType, nodeId) => {
  try {
    const response = await fetch(`http://localhost:8000/api/${nodeType}/${nodeId}`);
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
  background: radial-gradient(ellipse at center, #1a2130 0%, #090a0f 100%);
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  
  &:fullscreen {
    border-radius: 0;
  }
`;

const ControlPanel = styled.div`
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 10;
  background: rgba(30, 39, 51, 0.85);
  backdrop-filter: blur(6px);
  padding: 15px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 300px;
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);

  &:hover {
    background: rgba(40, 49, 61, 0.9);
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
  background: ${props => props.$active ? 'rgba(74, 159, 255, 0.2)' : 'rgba(60, 70, 90, 0.5)'};
  color: ${props => props.$active ? '#4a9fff' : '#d0d0d0'};
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
  
  &:hover {
    background: rgba(80, 100, 130, 0.7);
    border-color: rgba(255, 255, 255, 0.2);
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
  background: rgba(30, 39, 51, 0.85);
  backdrop-filter: blur(6px);
  padding: 15px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 240px;
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
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
  background: ${props => props.$active ? 'rgba(74, 159, 255, 0.3)' : 'rgba(30, 39, 51, 0.85)'};
  backdrop-filter: blur(6px);
  padding: 8px 12px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  color: ${props => props.$active ? '#fff' : '#e0e0e0'};
  border: 1px solid ${props => props.$active ? 'rgba(74, 159, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)'};
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  
  &:hover {
    background: ${props => props.$active ? 'rgba(74, 159, 255, 0.4)' : 'rgba(40, 49, 61, 0.9)'};
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
  background: rgba(30, 39, 51, 0.85);
  backdrop-filter: blur(6px);
  padding: 15px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  color: #e0e0e0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const AxisButton = styled.button`
  background: rgba(60, 70, 90, 0.5);
  color: #d0d0d0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 8px;
  font-size: 13px;
  font-weight: ${props => props.$center ? 'bold' : 'normal'};
  cursor: pointer;
  transition: all 0.2s ease;
  touch-action: none; /* Prevent scrolling when holding button on touchscreens */
  
  &:hover {
    background: rgba(80, 100, 130, 0.7);
    border-color: rgba(255, 255, 255, 0.2);
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

// =============================================================================
// Main Component
// =============================================================================

const NetworkViewer3D = forwardRef(({ results, height }, ref) => {
  // State variables
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [currentGeneration, setCurrentGeneration] = useState(0);
  const [maxGeneration, setMaxGeneration] = useState(0);
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
  const fgRef = useRef();
  const containerRef = useRef();

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
        // Match coefficient and compound ID
        const matches = trimmed.match(/^(\d*)([A-Za-z0-9]+)$/);
        if (matches) {
          return {
            id: matches[2],
            coefficient: matches[1] ? parseInt(matches[1]) : 1
          };
        }
        // Handle edge cases
        return { id: trimmed, coefficient: 1 };
      });
      
      // Process products (right side)
      const productItems = productsStr.split('+').map(item => {
        const trimmed = item.trim();
        // Match coefficient and compound ID
        const matches = trimmed.match(/^(\d*)([A-Za-z0-9]+)$/);
        if (matches) {
          return {
            id: matches[2],
            coefficient: matches[1] ? parseInt(matches[1]) : 1
          };
        }
        // Handle edge cases
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

    // For generation 0, show only compound nodes with generation 0
    if (currentGeneration === 0) {
      const filteredNodes = graphData.nodes.filter(
        node => node.type === 'compound' && node.generation === 0
      );
      
      return {
        nodes: filteredNodes,
        links: []
      };
    }
    
    // For other generations, apply specific filtering based on current generation
    // First, get nodes up to current generation
    let nodesForGeneration = graphData.nodes.filter(node => {
      if (node.type === 'compound') return node.generation <= currentGeneration;
      if (node.type === 'reaction') {
        if (node.subtype === 'reactant') return node.generation <= currentGeneration;
        if (node.subtype === 'product') return node.generation <= currentGeneration;
      }
      if (node.type === 'ec') return node.generation <= currentGeneration;
      return false;
    });
    
    // If hideEC is enabled, filter out EC nodes
    if (hideEC) {
      nodesForGeneration = nodesForGeneration.filter(node => node.type !== 'ec');
    }
    
    // Get IDs of all nodes for this generation
    const nodeIds = new Set(nodesForGeneration.map(node => node.id));
    
    // Filter links that connect nodes in this generation
    const linksForGeneration = graphData.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      return (
        link.generation <= currentGeneration && 
        nodeIds.has(sourceId) && 
        nodeIds.has(targetId)
      );
    });
    
    return {
      nodes: nodesForGeneration,
      links: linksForGeneration
    };
  }, [graphData, currentGeneration, hideEC]);

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
    return colors[generationIndex];
  }, []);

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
    if (hideLabels) return null; // Return null instead of empty string
    
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
      return link.color;
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
      return colors[sourceIndex]; // Using source node color for simplicity
    }
    
    // Fallback to provided color or default
    return link.color || '#ffffff';
  }, []);

  // =============================================================================
  // Effect Hooks
  // =============================================================================

  // Effect to process results and generate graph data
  useEffect(() => {
    if (!results || results.length === 0) return;
    
    setLoading(true);
    
    // Find maximum generation from compound_generation values
    let maxGen = 0;
    results.forEach(reaction => {
      Object.values(reaction.compound_generation).forEach(gen => {
        if (gen > maxGen) maxGen = gen;
      });
    });
    
    setMaxGeneration(maxGen);
    
    // Generate the graph data for all generations
    const { nodes, links } = processGraphData(results);
    
    setGraphData({ nodes, links });
    setLoading(false);
    
    // Initialize force graph with a timeout to ensure it's mounted
    setTimeout(() => {
      if (fgRef.current) {
        // Ensure simulation and forces are properly initialized
        if (fgRef.current.d3Force('charge')) {
          fgRef.current.d3Force('charge').strength(-120);
        }
        
        if (fgRef.current.d3Force('link')) {
          fgRef.current.d3Force('link').distance(link => {
            return link.type === 'dashed' ? 80 : (link.type === 'dotted' ? 60 : 50);
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
          fgRef.current.d3Force('charge', d3.forceManyBody().strength(-120));
        } else {
          fgRef.current.d3Force('charge').strength(-120);
        }
        
        if (!fgRef.current.d3Force('link')) {
          fgRef.current.d3Force('link', d3.forceLink().distance(link => {
            return link.type === 'dashed' ? 80 : (link.type === 'dotted' ? 60 : 50);
          }));
        } else {
          fgRef.current.d3Force('link').distance(link => {
            return link.type === 'dashed' ? 80 : (link.type === 'dotted' ? 60 : 50);
          });
        }
        
        if (!fgRef.current.d3Force('center')) {
          fgRef.current.d3Force('center', d3.forceCenter());
        }
      }
      
      // Reheat simulation
      fgRef.current.d3ReheatSimulation();
    }, 300);
    
  }, [layoutMode, graphData.nodes]);

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
      }, 1500);
      
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

  // Step backward one generation
  const stepBackward = () => {
    if (currentGeneration > 0) {
      setCurrentGeneration(currentGeneration - 1);
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  // Toggle node positions locked/unlocked
  const toggleNodesLocked = () => {
    setNodesLocked(!nodesLocked);
    
    if (fgRef.current) {
      // If locking nodes, simply freeze the simulation in place
      if (!nodesLocked) {
        // Stop simulation completely
        if (fgRef.current.graphData().nodes.length > 0) {
          // Fix nodes in their current positions
          fgRef.current.graphData().nodes.forEach(node => {
            node.fx = node.x;
            node.fy = node.y;
            node.fz = node.z;
          });
          fgRef.current.refresh();
        }
      } else {
        // Unfreeze nodes - remove fixed positions
        if (fgRef.current.graphData().nodes.length > 0) {
          fgRef.current.graphData().nodes.forEach(node => {
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
      if (fgRef.current.graphData().nodes.length > 0) {
        // Calculate the bounding box of all nodes
        const box = new THREE.Box3();
        
        fgRef.current.graphData().nodes.forEach(node => {
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
    
    // Set basic node data
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

  // =============================================================================
  // UI Component Rendering
  // =============================================================================

  // Control panel UI
  const renderControlPanel = () => (
    <ControlPanel>
      <SliderContainer>
        <SliderLabel>
          <span>Generation</span>
          <span>{currentGeneration} / {maxGeneration}</span>
        </SliderLabel>
        <Slider
          type="range"
          min={0}
          max={maxGeneration}
          value={currentGeneration}
          onChange={e => setCurrentGeneration(parseInt(e.target.value))}
        />
      </SliderContainer>
      
      <ButtonGroup>
        <Button 
          onClick={stepBackward}
          disabled={currentGeneration === 0}
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
              <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
            </svg> Play</>
          )}
        </Button>
        
        <Button 
          onClick={stepForward}
          disabled={currentGeneration === maxGeneration}
          $iconOnly={true}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM4.5 7.5a.5.5 0 0 0 0 1h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L10.293 7.5H4.5z"/>
          </svg>
        </Button>
      </ButtonGroup>
    </ControlPanel>
  );

  // Options panel UI
  const renderOptionsPanel = () => (
    <OptionsPanel>
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
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <Container ref={containerRef} style={{ height }}>
      <TopLeftButtonGroup>
        <ControlButton onClick={toggleFullscreen}>
          {isFullscreen ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
              Exit Fullscreen
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
              Fullscreen
            </>
          )}
        </ControlButton>
        
        <ControlButton onClick={toggleNodesLocked} $active={nodesLocked}>
          {nodesLocked ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Unlock Nodes
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Lock Nodes
            </>
          )}
        </ControlButton>
      </TopLeftButtonGroup>
      
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
        backgroundColor="rgba(0,0,0,0)"
        linkDirectionalParticleSpeed={0.1}
        linkCurvature={link => link.type === 'dashed' ? 0.3 : 0}
        enableNodeDrag={!nodesLocked}
        enableNavigationControls={true}
        showNavInfo={false}
        controlType="orbit"
        warmupTicks={500}
        cooldownTicks={500}
        width={isFullscreen ? window.innerWidth : undefined}
        height={isFullscreen ? window.innerHeight : undefined}
        onNodeClick={handleNodeClick}
        onNodeDragEnd={handleNodeDragEnd}
        onEngineStop={() => {
          // Save node positions after layout stabilizes
          if (fgRef.current) {
            fgRef.current.d3ReheatSimulation();
          }
        }}
      />
      
      {renderControlPanel()}
      {renderOptionsPanel()}
      
      <AxisControls>
        <AxisButton 
          className="x-axis" 
          onMouseDown={() => handleAxisControl('x', 'neg')}
          onMouseUp={handleAxisControlEnd}
          onMouseLeave={handleAxisControlEnd}
          onTouchStart={() => handleAxisControl('x', 'neg')}
          onTouchEnd={handleAxisControlEnd}
        >X-</AxisButton>
        <AxisButton 
          className="y-axis" 
          onMouseDown={() => handleAxisControl('y', 'neg')}
          onMouseUp={handleAxisControlEnd}
          onMouseLeave={handleAxisControlEnd}
          onTouchStart={() => handleAxisControl('y', 'neg')}
          onTouchEnd={handleAxisControlEnd}
        >Y-</AxisButton>
        <AxisButton 
          className="z-axis" 
          onMouseDown={() => handleAxisControl('z', 'neg')}
          onMouseUp={handleAxisControlEnd}
          onMouseLeave={handleAxisControlEnd}
          onTouchStart={() => handleAxisControl('z', 'neg')}
          onTouchEnd={handleAxisControlEnd}
        >Z-</AxisButton>
        <AxisButton 
          className="x-axis" 
          onMouseDown={() => handleAxisControl('x', 'pos')}
          onMouseUp={handleAxisControlEnd}
          onMouseLeave={handleAxisControlEnd}
          onTouchStart={() => handleAxisControl('x', 'pos')}
          onTouchEnd={handleAxisControlEnd}
        >X+</AxisButton>
        <AxisButton 
          className="y-axis" 
          onMouseDown={() => handleAxisControl('y', 'pos')}
          onMouseUp={handleAxisControlEnd}
          onMouseLeave={handleAxisControlEnd}
          onTouchStart={() => handleAxisControl('y', 'pos')}
          onTouchEnd={handleAxisControlEnd}
        >Y+</AxisButton>
        <AxisButton 
          className="z-axis" 
          onMouseDown={() => handleAxisControl('z', 'pos')}
          onMouseUp={handleAxisControlEnd}
          onMouseLeave={handleAxisControlEnd}
          onTouchStart={() => handleAxisControl('z', 'pos')}
          onTouchEnd={handleAxisControlEnd}
        >Z+</AxisButton>
        <AxisButton $center onClick={() => handleAxisControl('center')} style={{ gridColumn: '1 / span 3' }}>
          Fit To View
        </AxisButton>
      </AxisControls>
      
      {renderNodeInfoPanel()}
      
      <LoadingOverlay $loading={loading}>
        <Spinner />
        <div>Loading Network Data...</div>
      </LoadingOverlay>
    </Container>
  );
});

// =============================================================================
// Container Component
// =============================================================================

const NetworkViewerContainer = forwardRefReact(({ results, height }, ref) => {
  const innerRef = useRefReact();

  // Expose imperative API by delegating to the inner 3D viewer
  useImperativeHandle(ref, () => ({
    getNodePositions: () => innerRef.current?.getNodePositions?.(),
    setNodePositions: (positions) => innerRef.current?.setNodePositions?.(positions),
  }));

  return (
    <div style={{ width: '100%', height }}>
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