import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/examples/jsm/renderers/CSS2DRenderer";
import * as d3 from "d3";
import {
  Play,
  Pause,
  RotateCcw,
  Eye,
  EyeOff,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const NetworkViewer = ({ results, width = "100%", height = "100%" }) => {
  // Refs
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const labelRendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const simulationRef = useRef(null);
  const lightsRef = useRef([]);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentGeneration, setCurrentGeneration] = useState(0);
  const [maxGeneration, setMaxGeneration] = useState(0);
  const [showLabels, setShowLabels] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nodeCount, setNodeCount] = useState({
    compounds: 0,
    reactions: 0,
    ecs: 0,
  });
  const [hoveredNode, setHoveredNode] = useState(null);

  // Visual configuration
  const theme = {
    background: new THREE.Color("#f8fafc"),
    compound: {
      color: new THREE.Color("#00CCBF"),
      highlightColor: new THREE.Color("#00FFEF"),
      emissive: new THREE.Color("#72F2EB").multiplyScalar(0.2),
    },
    reaction: {
      color: new THREE.Color("#FF5F5D"),
      highlightColor: new THREE.Color("#FF2D2A"),
      emissive: new THREE.Color("#FF2D2A").multiplyScalar(0.15),
    },
    ec: {
      color: new THREE.Color("#B7D66C"),
      highlightColor: new THREE.Color("#A4CB44"),
      emissive: new THREE.Color("#A4CB44").multiplyScalar(0.15),
    },
    edge: {
      color: new THREE.Color("#545B5B"),
      highlightColor: new THREE.Color("#545B5B"),
      dashed: new THREE.Color("#929B9B"),
    },
  };

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = theme.background;
    scene.fog = new THREE.FogExp2(theme.background, 0.0015);
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(
      55,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      1,
      2000
    );
    camera.position.set(250, 150, 250);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Create renderers
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight
    );
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Label renderer
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight
    );
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0";
    labelRenderer.domElement.style.pointerEvents = "none";
    containerRef.current.appendChild(labelRenderer.domElement);
    labelRendererRef.current = labelRenderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.8;
    controls.panSpeed = 0.5;
    controls.screenSpacePanning = false;
    controls.maxDistance = 800;
    controls.minDistance = 50;
    controlsRef.current = controls;

    // Lighting setup
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);
    lightsRef.current.push(ambientLight);

    // Directional light (main)
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(200, 400, 200);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 1000;
    mainLight.shadow.camera.left = -500;
    mainLight.shadow.camera.right = 500;
    mainLight.shadow.camera.top = 500;
    mainLight.shadow.camera.bottom = -500;
    scene.add(mainLight);
    lightsRef.current.push(mainLight);

    // Hemispheric light
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xc7e7ff, 0.4);
    scene.add(hemiLight);
    lightsRef.current.push(hemiLight);

    // Accent lights for ambiance
    const accentLight1 = new THREE.PointLight(0x4f46e5, 0.6, 1000);
    accentLight1.position.set(-300, 200, 300);
    scene.add(accentLight1);
    lightsRef.current.push(accentLight1);

    const accentLight2 = new THREE.PointLight(0x06b6d4, 0.5, 800);
    accentLight2.position.set(300, -200, -200);
    scene.add(accentLight2);
    lightsRef.current.push(accentLight2);

    // Add a subtle ground plane with grid for better spatial reference
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
    const groundMaterial = new THREE.MeshBasicMaterial({
      color: 0xf1f5f9,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = Math.PI / 2;
    ground.position.y = -100;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add grid helper
    const gridHelper = new THREE.GridHelper(2000, 100, 0x94a3b8, 0xdde5f2);
    gridHelper.position.y = -100;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.15;
    scene.add(gridHelper);

    // Add raycaster for interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMove = (event) => {
      // Calculate mouse position in normalized device coordinates
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Update the raycaster with the camera and mouse position
      raycaster.setFromCamera(mouse, camera);

      // Check for intersections with nodes
      const intersects = raycaster.intersectObjects(nodesRef.current);

      if (intersects.length > 0) {
        const firstIntersect = intersects[0].object;
        if (firstIntersect.userData && firstIntersect.userData.nodeData) {
          // If we're hovering over a node, highlight it
          if (hoveredNode !== firstIntersect) {
            // Reset previous hovered node
            if (hoveredNode) {
              resetNodeAppearance(hoveredNode);
            }

            // Set new hovered node
            setHoveredNode(firstIntersect);
            highlightNode(firstIntersect);

            // Change cursor
            renderer.domElement.style.cursor = "pointer";
          }
        }
      } else if (hoveredNode) {
        // If we're not hovering over any node, reset the previously hovered node
        resetNodeAppearance(hoveredNode);
        setHoveredNode(null);
        renderer.domElement.style.cursor = "default";
      }
    };

    // Highlight node on hover
    function highlightNode(node) {
      const nodeData = node.userData.nodeData;
      if (nodeData) {
        const material = node.material;

        if (nodeData.type === "compound") {
          material.color.copy(theme.compound.highlightColor);
          material.emissive.copy(theme.compound.emissive).multiplyScalar(1.5);
        } else if (nodeData.type === "reaction") {
          material.color.copy(theme.reaction.highlightColor);
          material.emissive.copy(theme.reaction.emissive).multiplyScalar(1.5);
        } else {
          material.color.copy(theme.ec.highlightColor);
          material.emissive.copy(theme.ec.emissive).multiplyScalar(1.5);
        }

        // Increase the scale of the node
        node.scale.set(1.15, 1.15, 1.15);

        // Make label more visible
        if (node.children[0] && node.children[0].element) {
          node.children[0].element.style.backgroundColor =
            "rgba(255, 255, 255, 0.95)";
          node.children[0].element.style.fontWeight = "bold";
          node.children[0].element.style.boxShadow =
            "0 2px 8px rgba(0, 0, 0, 0.15)";
        }
      }
    }

    // Reset node appearance
    function resetNodeAppearance(node) {
      const nodeData = node.userData.nodeData;
      if (nodeData) {
        const material = node.material;

        if (nodeData.type === "compound") {
          material.color.copy(theme.compound.color);
          material.emissive.copy(theme.compound.emissive);
        } else if (nodeData.type === "reaction") {
          material.color.copy(theme.reaction.color);
          material.emissive.copy(theme.reaction.emissive);
        } else {
          material.color.copy(theme.ec.color);
          material.emissive.copy(theme.ec.emissive);
        }

        // Reset scale
        node.scale.set(1, 1, 1);

        // Reset label
        if (node.children[0] && node.children[0].element) {
          node.children[0].element.style.backgroundColor =
            "rgba(255, 255, 255, 0.8)";
          node.children[0].element.style.fontWeight = "";
          node.children[0].element.style.boxShadow =
            "0 2px 4px rgba(0, 0, 0, 0.1)";
        }
      }
    }

    // Add event listeners
    renderer.domElement.addEventListener("mousemove", onMouseMove);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();

      // Animate accent lights
      const time = Date.now() * 0.001;
      accentLight1.position.x = Math.sin(time * 0.3) * 300;
      accentLight1.position.z = Math.cos(time * 0.2) * 300;
      accentLight2.position.x = Math.sin(time * 0.2) * 300;
      accentLight2.position.z = Math.cos(time * 0.3) * 300;

      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
      labelRenderer.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);

    // Clean up
    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);

      if (containerRef.current) {
        if (renderer.domElement) {
          containerRef.current.removeChild(renderer.domElement);
        }
        if (labelRenderer.domElement) {
          containerRef.current.removeChild(labelRenderer.domElement);
        }
      }

      // Dispose geometries, materials, and textures
      nodesRef.current.forEach((node) => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach((m) => m.dispose());
          } else {
            node.material.dispose();
          }
        }
      });

      edgesRef.current.forEach((edge) => {
        if (edge.geometry) edge.geometry.dispose();
        if (edge.material) {
          if (Array.isArray(edge.material)) {
            edge.material.forEach((m) => m.dispose());
          } else {
            edge.material.dispose();
          }
        }
      });

      // Remove lights
      lightsRef.current.forEach((light) => {
        scene.remove(light);
      });

      scene.clear();
    };
  }, []);

  // Process data into graph structure
  useEffect(() => {
    if (!results || results.length === 0) return;

    setLoading(true);

    // Extract unique compounds, reactions, and ECs
    const compounds = new Map();
    const reactions = new Map();
    const ecs = new Map();
    const edges = [];

    let maxGen = 0;

    results.forEach((row) => {
      const { reaction, equation, ec_list = [], transition } = row;

      // Parse the generation transition (e.g., "0 -> 1")
      const [reactantGen, productGen] = transition
        .split(" -> ")
        .map((g) => parseInt(g.trim()));
      maxGen = Math.max(maxGen, productGen);

      // Parse equation to extract compounds
      const parts = equation.split("=>");
      const reactantsStr = parts[0].trim();
      const productsStr = parts.length > 1 ? parts[1].trim() : "";

      // Parse reactants with stoichiometry
      const reactants = [];
      reactantsStr.split("+").forEach((r) => {
        const trimmed = r.trim();
        const match = trimmed.match(/^(\d*)(.+)$/);
        if (match) {
          const stoichiometry = match[1] ? parseInt(match[1]) : 1;
          const compoundId = match[2].trim();

          // Add compound if not exists
          if (!compounds.has(compoundId)) {
            compounds.set(compoundId, {
              id: compoundId,
              type: "compound",
              generation: reactantGen,
            });
          }

          reactants.push({ compoundId, stoichiometry });
        }
      });

      // Parse products with stoichiometry
      const products = [];
      productsStr.split("+").forEach((p) => {
        const trimmed = p.trim();
        const match = trimmed.match(/^(\d*)(.+)$/);
        if (match) {
          const stoichiometry = match[1] ? parseInt(match[1]) : 1;
          const compoundId = match[2].trim();

          // Add compound if not exists
          if (!compounds.has(compoundId)) {
            compounds.set(compoundId, {
              id: compoundId,
              type: "compound",
              generation: productGen,
            });
          }

          products.push({ compoundId, stoichiometry });
        }
      });

      // Create reaction nodes (left and right)
      const reactionLeftId = `${reaction}_r`;
      const reactionRightId = `${reaction}_p`;

      if (!reactions.has(reactionLeftId)) {
        reactions.set(reactionLeftId, {
          id: reactionLeftId,
          type: "reaction",
          baseId: reaction,
          side: "left",
          generation: reactantGen,
        });
      }

      if (!reactions.has(reactionRightId)) {
        reactions.set(reactionRightId, {
          id: reactionRightId,
          type: "reaction",
          baseId: reaction,
          side: "right",
          generation: productGen,
        });
      }

      // Add EC nodes
      ec_list.forEach((ecNumber) => {
        if (!ecs.has(ecNumber)) {
          ecs.set(ecNumber, {
            id: ecNumber,
            type: "ec",
            generation: Math.max(reactantGen, productGen),
            relatedReactions: new Set([reaction]),
          });
        } else {
          // Add related reaction to the existing EC
          ecs.get(ecNumber).relatedReactions.add(reaction);
        }

        // Connect EC to reaction nodes
        edges.push({
          source: reactionLeftId,
          target: ecNumber,
          type: "dashed",
          generation: Math.max(reactantGen, productGen),
          genDifference: 0, // Same generation
        });

        edges.push({
          source: ecNumber,
          target: reactionRightId,
          type: "dashed",
          generation: Math.max(reactantGen, productGen),
          genDifference: Math.abs(productGen - reactantGen),
        });
      });

      // Connect reactant compounds to reaction left
      reactants.forEach(({ compoundId, stoichiometry }) => {
        edges.push({
          source: compoundId,
          target: reactionLeftId,
          type: "solid",
          weight: stoichiometry,
          generation: reactantGen,
          genDifference: 0, // Same generation
        });
      });

      // Connect reaction right to product compounds
      products.forEach(({ compoundId, stoichiometry }) => {
        edges.push({
          source: reactionRightId,
          target: compoundId,
          type: "solid",
          weight: stoichiometry,
          generation: productGen,
          genDifference: Math.abs(productGen - reactantGen),
        });
      });

      // Connect reaction left to reaction right
      edges.push({
        source: reactionLeftId,
        target: reactionRightId,
        type: "dashed",
        generation: Math.max(reactantGen, productGen),
        genDifference: Math.abs(productGen - reactantGen),
      });
    });

    // Convert EC's relatedReactions from Set to Array
    ecs.forEach((ec) => {
      ec.relatedReactions = Array.from(ec.relatedReactions);
    });

    // Combine all nodes
    const nodes = [
      ...Array.from(compounds.values()),
      ...Array.from(reactions.values()),
      ...Array.from(ecs.values()),
    ];

    // Update stats
    setNodeCount({
      compounds: compounds.size,
      reactions: Math.floor(reactions.size / 2), // Count each reaction only once (left and right)
      ecs: ecs.size,
    });

    setGraphData({ nodes, edges });
    setMaxGeneration(maxGen);
    setCurrentGeneration(0);
    setLoading(false);
  }, [results]);

  // Create and update the 3D visualization
  useEffect(() => {
    if (!graphData || !sceneRef.current) return;

    // Clear existing nodes and edges
    nodesRef.current.forEach((node) => {
      // Remove labels from the node
      node.children.forEach((child) => {
        if (child instanceof CSS2DObject) {
          sceneRef.current.remove(child);
        }
      });
      sceneRef.current.remove(node);
    });

    edgesRef.current.forEach((edge) => {
      // Remove labels from the edge
      edge.children.forEach((child) => {
        if (child instanceof CSS2DObject) {
          sceneRef.current.remove(child);
        }
      });
      sceneRef.current.remove(edge);
    });

    nodesRef.current = [];
    edgesRef.current = [];

    // Filter nodes and edges by current generation
    const visibleNodes = graphData.nodes.filter(
      (node) => node.generation <= currentGeneration
    );

    const visibleEdges = graphData.edges.filter(
      (edge) => edge.generation <= currentGeneration
    );

    // Create node objects for simulation
    const nodeObjects = visibleNodes.map((node) => ({
      ...node,
      x: node.x || (Math.random() - 0.5) * 150,
      y: node.y || (Math.random() - 0.5) * 150,
      z: node.z || (Math.random() - 0.5) * 150,
    }));

    // Create map of nodes by ID for edge creation
    const nodeMap = new Map();
    nodeObjects.forEach((node) => nodeMap.set(node.id, node));

    // Create edge objects with references to node objects
    const edgeObjects = visibleEdges
      .filter((edge) => nodeMap.has(edge.source) && nodeMap.has(edge.target))
      .map((edge) => ({
        ...edge,
        sourceNode: nodeMap.get(edge.source),
        targetNode: nodeMap.get(edge.target),
      }));

    // Split nodes by type for different force treatments
    const compoundNodes = nodeObjects.filter(
      (node) => node.type === "compound"
    );
    const reactionNodes = nodeObjects.filter(
      (node) => node.type === "reaction"
    );
    const ecNodes = nodeObjects.filter((node) => node.type === "ec");

    // Group reaction nodes by baseId for same-reaction handling
    const reactionsByBase = {};
    reactionNodes.forEach((node) => {
      if (!reactionsByBase[node.baseId]) {
        reactionsByBase[node.baseId] = [];
      }
      reactionsByBase[node.baseId].push(node);
    });

    // Group EC nodes by related reactions
    const ecByReaction = {};
    ecNodes.forEach((node) => {
      if (node.relatedReactions) {
        node.relatedReactions.forEach((reactionId) => {
          if (!ecByReaction[reactionId]) {
            ecByReaction[reactionId] = [];
          }
          ecByReaction[reactionId].push(node);
        });
      }
    });

    // Create enhanced force simulation (3D)
    const simulation = d3
      .forceSimulation(nodeObjects)
      .alphaTarget(0.1)
      .force(
        "charge",
        d3
          .forceManyBody()
          .strength((d) => {
            const baseStrength = -120;
            const genMultiplier = 1 + (d.generation || 0) * 0.2;
            if (d.type === "compound")
              return baseStrength * 1.5 * genMultiplier;
            if (d.type === "reaction")
              return baseStrength * 1.0 * genMultiplier;
            return baseStrength * 1.2 * genMultiplier; // EC
          })
          .distanceMax(700)
      )
      .force("center", d3.forceCenter(0, 0))
      .force(
        "radial",
        d3.forceRadial((d) => {
          const baseRadius = 100;
          const genRadius = d.generation * 30;
          if (d.type === "compound") return baseRadius + genRadius + 20;
          if (d.type === "reaction") return baseRadius + genRadius;
          return baseRadius + genRadius - 10; // EC
        })
      )
      .force(
        "collision",
        d3.forceCollide().radius((d) => {
          if (d.type === "compound") return 20;
          if (d.type === "reaction") return 15;
          return 17; // EC
        })
      )
      .force(
        "link",
        d3
          .forceLink(edgeObjects)
          .id((d) => d.id)
          .distance((d) => {
            const baseDist = d.type === "dashed" ? 50 : 80;
            const genEffect = (d.genDifference || 0) * 15;
            const weightEffect = (d.weight || 1) * 5;
            return baseDist + genEffect + weightEffect;
          })
          .strength((d) => {
            const baseStrength = d.type === "dashed" ? 0.8 : 0.6;
            const genFactor = 1 / (1 + (d.genDifference || 0) * 0.5);
            const weightFactor = 1 / Math.sqrt(d.weight || 1);
            return baseStrength * genFactor * weightFactor;
          })
      );

    // Add custom 3D force
    const applyCustom3DForces = () => {
      nodeObjects.forEach((node) => {
        if (!node.fx3d) node.fx3d = 0;
        if (!node.fy3d) node.fy3d = 0;
        if (!node.fz3d) node.fz3d = 0;
        node.fx3d = 0;
        node.fy3d = 0;
        node.fz3d = 0;
      });

      for (let i = 0; i < nodeObjects.length; i++) {
        const nodeA = nodeObjects[i];
        for (let j = i + 1; j < nodeObjects.length; j++) {
          const nodeB = nodeObjects[j];
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const dz = nodeB.z - nodeA.z || 0;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (distance === 0) continue;
          let strength = -150 / (distance * distance);
          if (nodeA.type === nodeB.type) {
            strength *= 1.5;
            if (nodeA.type === "reaction" && nodeA.baseId === nodeB.baseId) {
              strength = 50 / distance;
            }
            if (
              nodeA.type === "ec" &&
              nodeA.relatedReactions &&
              nodeB.relatedReactions
            ) {
              const commonReactions = nodeA.relatedReactions.filter((r) =>
                nodeB.relatedReactions.includes(r)
              );
              if (commonReactions.length > 0) {
                strength = 40 / distance;
              }
            }
          }
          const genDiff = Math.abs(
            (nodeA.generation || 0) - (nodeB.generation || 0)
          );
          strength *= 1 + genDiff * 0.3;
          const fx = (dx / distance) * strength;
          const fy = (dy / distance) * strength;
          const fz = (dz / distance) * strength;
          nodeA.fx3d -= fx;
          nodeA.fy3d -= fy;
          nodeA.fz3d -= fz;
          nodeB.fx3d += fx;
          nodeB.fy3d += fy;
          nodeB.fz3d += fz;
        }
      }

      edgeObjects.forEach((edge) => {
        const sourceNode = edge.sourceNode;
        const targetNode = edge.targetNode;
        if (!sourceNode || !targetNode) return;
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const dz = (targetNode.z || 0) - (sourceNode.z || 0);
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (distance === 0) return;
        let strength = edge.type === "dashed" ? 0.01 : 0.02;
        const genDiff = edge.genDifference || 0;
        if (genDiff > 0) {
          const zForce = genDiff * 2;
          if (sourceNode.generation < targetNode.generation) {
            sourceNode.fz3d -= zForce;
            targetNode.fz3d += zForce;
          } else {
            sourceNode.fz3d += zForce;
            targetNode.fz3d -= zForce;
          }
          strength *= 0.8;
        }
        const fx = dx * strength;
        const fy = dy * strength;
        const fz = dz * strength;
        sourceNode.fx3d += fx;
        sourceNode.fy3d += fy;
        sourceNode.fz3d += fz;
        targetNode.fx3d -= fx;
        targetNode.fy3d -= fy;
        targetNode.fz3d -= fz;
      });

      nodeObjects.forEach((node) => {
        const targetZ = node.generation * 60;
        const zDiff = targetZ - (node.z || 0);
        node.fz3d += zDiff * 0.05;
        const damping = 0.7;
        node.x += node.fx3d * damping;
        node.y += node.fy3d * damping;
        node.z = (node.z || 0) + node.fz3d * damping;
      });
    };

    const originalTick = simulation.tick;
    simulation.tick = function () {
      originalTick.call(this);
      applyCustom3DForces();
      return this;
    };

    simulation.tick(300);

    // Create 3D objects for nodes
    nodeObjects.forEach((node) => {
      let geometry, material;
      if (node.type === "compound") {
        geometry = new THREE.SphereGeometry(10, 32, 32);
        material = new THREE.MeshPhongMaterial({
          color: theme.compound.color,
          emissive: theme.compound.emissive,
          specular: 0x111111,
          shininess: 70,
          transparent: false,
          opacity: 1,
        });
      } else if (node.type === "reaction") {
        geometry = new THREE.SphereGeometry(6, 24, 24);
        material = new THREE.MeshPhongMaterial({
          color: theme.reaction.color,
          emissive: theme.reaction.emissive,
          specular: 0x222222,
          shininess: 10,
          transparent: false,
          opacity: 1,
        });
      } else {
        // ec
        geometry = new THREE.IcosahedronGeometry(9);
        material = new THREE.MeshPhongMaterial({
          color: theme.ec.color,
          emissive: theme.ec.emissive,
          specular: 0x222222,
          shininess: 50,
          transparent: false,
          opacity: 1,
        });
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(node.x, node.y, node.z || 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { nodeData: node };

      // Create label
      const labelDiv = document.createElement("div");
      labelDiv.className = "labelDiv";
      labelDiv.textContent = node.id;
      if (node.type === "compound") {
        labelDiv.style.color = "#1e40af";
        labelDiv.style.borderBottom = "2px solid #3b82f6";
      } else if (node.type === "reaction") {
        labelDiv.style.color = "#9a3412";
        labelDiv.style.borderBottom = "2px solid #f97316";
      } else {
        // ec
        labelDiv.style.color = "#065f46";
        labelDiv.style.borderBottom = "2px solid #10b981";
      }
      labelDiv.style.fontSize = "11px";
      labelDiv.style.fontWeight = "medium";
      labelDiv.style.padding = "3px 8px";
      labelDiv.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
      labelDiv.style.borderRadius = "6px";
      labelDiv.style.pointerEvents = "none";
      labelDiv.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
      labelDiv.style.transition = "all 0.15s ease";

      const label = new CSS2DObject(labelDiv);
      if (node.type === "compound") {
        label.position.set(0, 14, 0);
      } else if (node.type === "reaction") {
        label.position.set(0, 10, 0);
      } else {
        // ec
        label.position.set(0, 12, 0);
      }
      label.visible = showLabels;
    //   mesh.add(label);

      sceneRef.current.add(mesh);
      nodesRef.current.push(mesh);
    });

    // Create 3D objects for edges
    edgeObjects.forEach((edge) => {
      const sourcePos = new THREE.Vector3(
        edge.sourceNode.x,
        edge.sourceNode.y,
        edge.sourceNode.z || 0
      );
      const targetPos = new THREE.Vector3(
        edge.targetNode.x,
        edge.targetNode.y,
        edge.targetNode.z || 0
      );
      let edgeObject;
      if (edge.type === "dashed") {
        const geometry = new THREE.BufferGeometry().setFromPoints([
          sourcePos,
          targetPos,
        ]);
        const material = new THREE.LineDashedMaterial({
          color: theme.edge.dashed,
          linewidth: 1,
          scale: 1,
          dashSize: 3,
          gapSize: 2,
          opacity: 0.7,
          transparent: true,
        });
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        edgeObject = line;
      } else {
        const midpoint = new THREE.Vector3()
          .addVectors(sourcePos, targetPos)
          .multiplyScalar(0.5);
        const curve = new THREE.CubicBezierCurve3(
          sourcePos,
          new THREE.Vector3(
            midpoint.x + (Math.random() - 0.5) * 5,
            midpoint.y + (Math.random() - 0.5) * 5,
            midpoint.z + (Math.random() - 0.5) * 5
          ),
          new THREE.Vector3(
            midpoint.x + (Math.random() - 0.5) * 5,
            midpoint.y + (Math.random() - 0.5) * 5,
            midpoint.z + (Math.random() - 0.5) * 5
          ),
          targetPos
        );
        const tubeRadius = Math.max(
          0.5,
          Math.min(2, 0.8 + (edge.weight || 1) * 0.3)
        );
        const geometry = new THREE.TubeGeometry(curve, 8, tubeRadius, 8, false);
        const material = new THREE.MeshPhongMaterial({
          color: theme.edge.color,
          transparent: true,
          opacity: 0.8,
          shininess: 30,
        });
        edgeObject = new THREE.Mesh(geometry, material);
        edgeObject.castShadow = true;
      }
      edgeObject.userData = { edgeData: edge };
      if (edge.weight && edge.weight > 1) {
        const labelDiv = document.createElement("div");
        labelDiv.className = "edgeLabelDiv";
        labelDiv.textContent = edge.weight.toString();
        labelDiv.style.color = "#ffffff";
        labelDiv.style.fontSize = "10px";
        labelDiv.style.fontWeight = "bold";
        labelDiv.style.padding = "1px 5px";
        labelDiv.style.backgroundColor = "rgba(79, 70, 229, 0.85)";
        labelDiv.style.borderRadius = "8px";
        labelDiv.style.pointerEvents = "none";
        const midpoint = new THREE.Vector3()
          .addVectors(sourcePos, targetPos)
          .multiplyScalar(0.5);
        const label = new CSS2DObject(labelDiv);
        label.position.copy(midpoint);
        label.visible = showLabels;
        edgeObject.add(label);
      }
      sceneRef.current.add(edgeObject);
      edgesRef.current.push(edgeObject);
    });

    simulationRef.current = simulation;

    // Adjust camera to fit all nodes
    if (cameraRef.current && nodeObjects.length > 0) {
      const box = new THREE.Box3();
      nodesRef.current.forEach((node) => box.expandByObject(node));
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.y, size.z);
      const fitHeightDistance =
        maxSize / (2 * Math.tan((Math.PI * cameraRef.current.fov) / 360));
      const fitWidthDistance = fitHeightDistance / cameraRef.current.aspect;
      const distance = 1.2 * Math.max(fitHeightDistance, fitWidthDistance);
      const direction = new THREE.Vector3(1, 0.8, 1).normalize();
      cameraRef.current.position
        .copy(center)
        .add(direction.multiplyScalar(distance));
      cameraRef.current.lookAt(center);
      if (controlsRef.current) {
        controlsRef.current.target.copy(center);
        controlsRef.current.update();
      }
    }
  }, [graphData, currentGeneration, showLabels]);

  // Handle animation for generation expansion
  useEffect(() => {
    let animationInterval;

    if (isPlaying && currentGeneration < maxGeneration) {
      animationInterval = setInterval(() => {
        setCurrentGeneration((prev) => {
          const next = prev + 1;
          if (next > maxGeneration) {
            setIsPlaying(false);
            return maxGeneration;
          }
          return next;
        });
      }, 1800); // Animation speed
    }

    return () => {
      if (animationInterval) {
        clearInterval(animationInterval);
      }
    };
  }, [isPlaying, currentGeneration, maxGeneration]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreenNow = !!(
        document.fullscreenElement ||
        document.mozFullScreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      );

      setIsFullscreen(isFullscreenNow);

      // Update renderer size
      if (
        rendererRef.current &&
        labelRendererRef.current &&
        containerRef.current
      ) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        if (cameraRef.current) {
          cameraRef.current.aspect = width / height;
          cameraRef.current.updateProjectionMatrix();
        }

        rendererRef.current.setSize(width, height);
        labelRendererRef.current.setSize(width, height);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange
      );
    };
  }, []);

  // Update label visibility
  useEffect(() => {
    nodesRef.current.forEach((node) => {
      if (node.children && node.children.length > 0) {
        node.children[0].visible = showLabels;
      }
    });

    edgesRef.current.forEach((edge) => {
      if (edge.children && edge.children.length > 0) {
        edge.children.forEach((child) => {
          if (child instanceof CSS2DObject) {
            child.visible = showLabels;
          }
        });
      }
    });
  }, [showLabels]);

  // Toggle fullscreen
  const toggleFullscreen = () => {
    const element = containerRef.current.parentElement;

    if (!isFullscreen) {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  // Controls and UI handlers
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentGeneration(0);
  };

  // Function to toggle labels
  const toggleLabelsVisibility = () => {
    setShowLabels(!showLabels);
  };

  const zoomIn = () => {
    if (controlsRef.current) {
      // Simulate mousewheel zoom in
      controlsRef.current.dollyIn(1.2);
      controlsRef.current.update();
    }
  };

  const zoomOut = () => {
    if (controlsRef.current) {
      // Simulate mousewheel zoom out
      controlsRef.current.dollyOut(1.2);
      controlsRef.current.update();
    }
  };

  // Render
  return (
    <div
      className={`bg-white border rounded-xl shadow-md overflow-hidden transition-all ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none" : ""
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b flex justify-between items-center bg-gradient-to-r from-slate-50 to-blue-50">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <path d="M12 17h.01"></path>
            </svg>
          </span>
          3D Metabolic Network
        </h3>
        <div className="flex items-center gap-3">
          <div className="hidden md:block text-sm font-medium bg-white py-1 px-3 rounded-full border border-slate-200 text-slate-600 shadow-sm">
            Generation: {currentGeneration} / {maxGeneration}
          </div>

          <div className="hidden md:flex gap-1 text-xs font-medium bg-white py-1 px-3 rounded-full border border-slate-200 text-slate-600 shadow-sm">
            <span className="text-blue-600">
              {nodeCount.compounds} Compounds
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-orange-600">
              {nodeCount.reactions} Reactions
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-emerald-600">{nodeCount.ecs} ECs</span>
          </div>
        </div>
      </div>

      {/* Render container */}
      <div
        ref={containerRef}
        style={{
          width: isFullscreen ? "100vw" : width,
          height: isFullscreen ? "calc(100vh - 110px)" : height,
        }}
        className="relative"
      >
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-slate-700 font-medium">
                Building metabolic network...
              </p>
              <p className="text-slate-500 text-sm mt-1">
                This may take a moment
              </p>
            </div>
          </div>
        )}

        {/* Floating controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <button
            onClick={toggleLabelsVisibility}
            className={`p-2 ${
              showLabels
                ? "bg-blue-500 text-white"
                : "bg-white text-slate-600 border border-slate-200"
            } rounded-lg shadow-md hover:shadow-lg transition-all`}
            title={showLabels ? "Hide Labels" : "Show Labels"}
          >
            {showLabels ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={toggleFullscreen}
            className={`p-2 ${
              isFullscreen
                ? "bg-blue-500 text-white"
                : "bg-white text-slate-600 border border-slate-200"
            } rounded-lg shadow-md hover:shadow-lg transition-all`}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize className="w-5 h-5" />
            ) : (
              <Maximize className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={zoomIn}
            className="p-2 bg-white text-slate-600 border border-slate-200 rounded-lg shadow-md hover:shadow-lg transition-all"
            title="Zoom In"
          >
            <ZoomIn className="w-5 h-5" />
          </button>

          <button
            onClick={zoomOut}
            className="p-2 bg-white text-slate-600 border border-slate-200 rounded-lg shadow-md hover:shadow-lg transition-all"
            title="Zoom Out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Controls bar */}
      <div className="px-4 py-3 border-t bg-gradient-to-r from-slate-50 to-blue-50 flex items-center">
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className={`p-2 ${
              currentGeneration === 0
                ? "text-slate-400"
                : "text-slate-600 hover:text-blue-600 hover:bg-blue-50"
            } rounded-lg transition-colors`}
            disabled={loading || currentGeneration === 0}
            title="Reset to Generation 0"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={handlePlayPause}
            className={`p-2 rounded-lg transition-colors ${
              isPlaying
                ? "bg-red-100 text-red-600 hover:bg-red-200"
                : "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
            }`}
            disabled={loading || currentGeneration === maxGeneration}
            title={isPlaying ? "Pause Animation" : "Play Animation"}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>
        </div>

        <div className="flex-1 mx-4">
          <div className="relative pt-1">
            <input
              type="range"
              className="w-full h-2 appearance-none rounded-lg focus:outline-none focus:ring-0 bg-slate-200"
              style={{
                background: `linear-gradient(to right, #3b82f6 ${
                  (currentGeneration / maxGeneration) * 100
                }%, #e2e8f0 ${(currentGeneration / maxGeneration) * 100}%)`,
              }}
              min={0}
              max={maxGeneration}
              value={currentGeneration}
              onChange={(e) => {
                setCurrentGeneration(parseInt(e.target.value));
                setIsPlaying(false);
              }}
              disabled={loading}
            />

            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Gen {currentGeneration}</span>
              <span className="md:hidden">/ {maxGeneration}</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500 hidden sm:block">
          Drag to rotate • Scroll to zoom
        </div>
      </div>
    </div>
  );
};

export default NetworkViewer;
