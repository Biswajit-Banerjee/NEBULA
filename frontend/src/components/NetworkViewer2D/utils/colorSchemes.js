/**
 * Calculates appropriate colors for nodes based on type and generation
 * @param {Object} node - The node object with type and generation properties
 * @param {number} maxGeneration - The maximum generation in the dataset
 * @returns {Object} Fill and stroke colors
 */
export const getNodeColor = (node, maxGeneration) => {
    const generation = node.generation || 0;
    const maxGen = Math.max(maxGeneration, 1); // Ensure we don't divide by zero
    const hue = (generation / (maxGen + 1)) * 360; // Distribute hues evenly up to maxGen
    const saturation = node.type === "compound" ? 80 : 60; // Compounds more vibrant
    const lightness = node.type === "compound" ? 85 : 90; // Compounds slightly darker
    
    let fill, stroke;
    
    switch (node.type) {
      case "compound":
        fill = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        stroke = `hsl(${hue}, ${saturation}%, 50%)`;
        break;
      case "reaction-in":
      case "reaction-out":
        fill = `hsl(${hue}, 50%, 90%)`;  
        stroke = `hsl(${hue}, 70%, 60%)`;
        break;
      case "ec":
        fill = "white";
        stroke = `hsl(${hue}, 80%, 60%)`;
        break;
      default:
        // Default colors for any other node types
        fill = `hsl(${hue}, 40%, 90%)`;
        stroke = `hsl(${hue}, 40%, 60%)`;
    }
    
    return { fill, stroke };
  };
  
  /**
   * Calculates appropriate colors for links based on type and generation
   * @param {Object} link - The link object with type and generation properties
   * @param {number} maxGeneration - The maximum generation in the dataset
   * @returns {string} Color value as string
   */
  export const getLinkColor = (link, maxGeneration) => {
    if (link.type === "reaction") return "#9CA3AF"; // Gray for reaction internal links
    if (link.type.startsWith("ec")) return "#8B5CF6"; // Purple for EC connections
    
    // For substrate and product links, use generation-based coloring
    const generation = link.generation || 0;
    const maxGen = Math.max(maxGeneration, 1);
    const hue = (generation / (maxGen + 1)) * 360;
    
    return `hsl(${hue}, 70%, 50%)`;
  };