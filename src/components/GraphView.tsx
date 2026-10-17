import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GraphData, GraphNode, GraphLink, Category, Folder } from '../types';
import { api } from '../api';
import {
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Play,
  Pause,
  RotateCcw,
  BookOpen,
  FileText,
  FileCode,
  Film,
  Music,
  Sliders,
  ExternalLink,
  Info,
  X
} from 'lucide-react';

interface GraphViewProps {
  categories: Category[];
  folders: Folder[];
  onSelectNote: (id: string) => void;
  onSelectReference: (id: string) => void;
  onClose?: () => void;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  fx?: number | null;
  fy?: number | null;
}

interface SimLink {
  id: string;
  source: SimNode;
  target: SimNode;
  type: 'wikilink' | 'citation';
  label?: string;
}

export const GraphView: React.FC<GraphViewProps> = ({
  categories,
  folders,
  onSelectNote,
  onSelectReference,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Raw Graph Data
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State (RF-33)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'notes' | 'references'>('all');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all');
  const [minDegree, setMinDegree] = useState<number>(0);
  const [hideIsolated, setHideIsolated] = useState<boolean>(false);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [isPhysicsActive, setIsPhysicsActive] = useState<boolean>(true);
  const [showFiltersPanel, setShowFiltersPanel] = useState<boolean>(false);

  // Camera transform state (pan & zoom)
  const transformRef = useRef<{ x: number; y: number; k: number }>({ x: 0, y: 0, k: 1 });
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Simulation references
  const simNodesRef = useRef<SimNode[]>([]);
  const simLinksRef = useRef<SimLink[]>([]);
  const animFrameIdRef = useRef<number | null>(null);
  const isDraggingNodeRef = useRef<SimNode | null>(null);
  const isPanningRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Hover & selection
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Load Graph Data from API
  const loadGraph = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getGraphData();
      setGraphData(data);
    } catch (err: unknown) {
      console.error('Erro ao carregar grafo:', err);
      setError('Não foi possível carregar os dados do grafo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  // Compute filtered nodes and links
  const { filteredNodes, filteredLinks, maxPossibleDegree } = useMemo(() => {
    let maxDeg = 0;
    const query = searchQuery.toLowerCase().trim();

    // 1. Filter Nodes
    const nodes = graphData.nodes.filter((node) => {
      if (node.degree > maxDeg) maxDeg = node.degree;

      // Type filter
      if (filterType === 'notes' && node.type !== 'note') return false;
      if (filterType === 'references' && node.type !== 'reference') return false;

      // Category filter
      if (filterCategoryId !== 'all' && node.category_id !== filterCategoryId) return false;

      // Min degree filter
      if (node.degree < minDegree) return false;

      // Hide isolated
      if (hideIsolated && node.degree === 0) return false;

      // Search query
      if (query) {
        const titleMatch = node.title.toLowerCase().includes(query);
        const tagMatch = node.tags?.some((t) => t.toLowerCase().includes(query));
        const catMatch = node.category_name?.toLowerCase().includes(query);
        if (!titleMatch && !tagMatch && !catMatch) return false;
      }

      return true;
    });

    const activeNodeIds = new Set(nodes.map((n) => n.id));

    // 2. Filter Links (both source and target must be active)
    const links = graphData.links.filter(
      (link) => activeNodeIds.has(link.source) && activeNodeIds.has(link.target)
    );

    return { filteredNodes: nodes, filteredLinks: links, maxPossibleDegree: Math.max(maxDeg, 5) };
  }, [graphData, searchQuery, filterType, filterCategoryId, minDegree, hideIsolated]);

  // Synchronize Simulation Nodes with Filtered Nodes
  useEffect(() => {
    const existingSimNodesMap = new Map<string, SimNode>();
    for (const sn of simNodesRef.current) {
      existingSimNodesMap.set(sn.id, sn);
    }

    const container = containerRef.current;
    const width = container ? container.clientWidth : 800;
    const height = container ? container.clientHeight : 600;
    const cx = width / 2;
    const cy = height / 2;

    const count = filteredNodes.length;
    const radiusSpread = Math.min(width, height) * 0.38;

    const newSimNodes: SimNode[] = filteredNodes.map((n, idx) => {
      const existing = existingSimNodesMap.get(n.id);
      const baseRadius = n.type === 'note' ? 14 : 12;
      const degBonus = Math.min(16, n.degree * 2.5);
      const radius = baseRadius + degBonus;

      if (existing) {
        existing.degree = n.degree;
        existing.radius = radius;
        existing.category_color = n.category_color;
        existing.category_name = n.category_name;
        existing.title = n.title;
        return existing;
      }

      // Initial placement in concentric layout or circular dispersion
      const angle = (idx / Math.max(1, count)) * Math.PI * 2;
      const dist = radiusSpread * (0.3 + 0.7 * Math.random());
      return {
        ...n,
        x: cx + Math.cos(angle) * dist + (Math.random() - 0.5) * 40,
        y: cy + Math.sin(angle) * dist + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        radius
      };
    });

    const nodeById = new Map<string, SimNode>();
    for (const sn of newSimNodes) {
      nodeById.set(sn.id, sn);
    }

    const newSimLinks: SimLink[] = [];
    for (const fl of filteredLinks) {
      const src = nodeById.get(fl.source);
      const tgt = nodeById.get(fl.target);
      if (src && tgt && src !== tgt) {
        newSimLinks.push({
          id: fl.id,
          source: src,
          target: tgt,
          type: fl.type,
          label: fl.label
        });
      }
    }

    simNodesRef.current = newSimNodes;
    simLinksRef.current = newSimLinks;
  }, [filteredNodes, filteredLinks]);

  // Center & Fit graph view to canvas
  const handleFitView = useCallback(() => {
    const nodes = simNodesRef.current;
    const container = containerRef.current;
    if (!container || nodes.length === 0) {
      transformRef.current = { x: 0, y: 0, k: 1 };
      setZoomLevel(100);
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }

    const graphWidth = Math.max(100, maxX - minX + 80);
    const graphHeight = Math.max(100, maxY - minY + 80);
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const scaleX = (containerWidth * 0.85) / graphWidth;
    const scaleY = (containerHeight * 0.85) / graphHeight;
    const k = Math.min(2.5, Math.max(0.25, Math.min(scaleX, scaleY)));

    const graphCenterX = (minX + maxX) / 2;
    const graphCenterY = (minY + maxY) / 2;

    const x = containerWidth / 2 - graphCenterX * k;
    const y = containerHeight / 2 - graphCenterY * k;

    transformRef.current = { x, y, k };
    setZoomLevel(Math.round(k * 100));
  }, []);

  // Run simulation physics step (Force-Directed Coulomb + Hooke + Centering)
  const runPhysicsStep = useCallback(() => {
    if (!isPhysicsActive) return;

    const nodes = simNodesRef.current;
    const links = simLinksRef.current;
    const container = containerRef.current;
    if (!container || nodes.length === 0) return;

    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2;

    // 1. Centering gravity force
    const gravity = 0.015;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.fx !== undefined && n.fx !== null) continue;
      n.vx += (cx - n.x) * gravity;
      n.vy += (cy - n.y) * gravity;
    }

    // 2. Coulomb Repulsion between pairs of nodes
    const repulsionStrength = 1800;
    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const distSq = dx * dx + dy * dy + 1;
        const dist = Math.sqrt(distSq);

        // Minimum distance to prevent extreme explosive repulsion
        const minDist = n1.radius + n2.radius + 18;
        let force = (repulsionStrength / distSq);
        if (dist < minDist) {
          force += (minDist - dist) * 0.12;
        }

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (n1.fx === undefined || n1.fx === null) {
          n1.vx -= fx;
          n1.vy -= fy;
        }
        if (n2.fx === undefined || n2.fx === null) {
          n2.vx += fx;
          n2.vy += fy;
        }
      }
    }

    // 3. Hooke Spring Attraction along links
    const linkStiffness = 0.045;
    const baseLength = 100;
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const src = link.source;
      const tgt = link.target;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const delta = dist - baseLength;
      const force = delta * linkStiffness;

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (src.fx === undefined || src.fx === null) {
        src.vx += fx;
        src.vy += fy;
      }
      if (tgt.fx === undefined || tgt.fx === null) {
        tgt.vx -= fx;
        tgt.vy -= fy;
      }
    }

    // 4. Velocity damping & position updates
    const damping = 0.86;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.fx !== undefined && n.fx !== null) {
        n.x = n.fx;
        n.y = n.fy !== undefined && n.fy !== null ? n.fy : n.y;
        n.vx = 0;
        n.vy = 0;
      } else {
        n.vx *= damping;
        n.vy *= damping;
        n.x += n.vx;
        n.y += n.vy;
      }
    }
  }, [isPhysicsActive]);

  // Render loop using Canvas 2D
  useEffect(() => {
    let isCancelled = false;

    const render = () => {
      if (isCancelled) return;

      runPhysicsStep();

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) {
        animFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = container.clientWidth;
      const height = container.clientHeight;
      const dpr = window.devicePixelRatio || 1;

      // Handle retina resizing
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const { x: panX, y: panY, k: zoom } = transformRef.current;
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);

      const nodes = simNodesRef.current;
      const links = simLinksRef.current;
      const hovered = hoveredNode;

      // Check connected nodes for focus highlight
      const connectedNodeIds = new Set<string>();
      if (hovered) {
        connectedNodeIds.add(hovered.id);
        for (const l of links) {
          if (l.source.id === hovered.id) connectedNodeIds.add(l.target.id);
          if (l.target.id === hovered.id) connectedNodeIds.add(l.source.id);
        }
      }

      // Check current theme colors
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const defaultTextColor = isDark ? '#f3f4f6' : '#1f2937';
      const edgeDefaultColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.14)';
      const edgeHighlightColor = isDark ? 'rgba(234, 179, 8, 0.85)' : 'rgba(202, 138, 4, 0.85)';
      const citationColor = isDark ? 'rgba(59, 130, 246, 0.7)' : 'rgba(37, 99, 235, 0.7)';

      // 1. Draw Links
      for (const link of links) {
        const isHoveredLink =
          hovered && (link.source.id === hovered.id || link.target.id === hovered.id);
        const isDimmed = hovered && !isHoveredLink;

        ctx.beginPath();
        ctx.moveTo(link.source.x, link.source.y);
        ctx.lineTo(link.target.x, link.target.y);

        if (isDimmed) {
          ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
        } else if (isHoveredLink) {
          ctx.strokeStyle = link.type === 'citation' ? '#3b82f6' : edgeHighlightColor;
          ctx.lineWidth = 2.5;
          ctx.setLineDash(link.type === 'citation' ? [5, 4] : []);
        } else {
          ctx.strokeStyle = link.type === 'citation' ? citationColor : edgeDefaultColor;
          ctx.lineWidth = link.type === 'citation' ? 1.5 : 1.2;
          ctx.setLineDash(link.type === 'citation' ? [4, 4] : []);
        }

        ctx.stroke();
        ctx.setLineDash([]);

        // Draw directional arrow on wikilinks
        if (!isDimmed && (isHoveredLink || zoom >= 0.8)) {
          const dx = link.target.x - link.source.x;
          const dy = link.target.y - link.source.y;
          const angle = Math.atan2(dy, dx);
          const arrowDist = link.target.radius + 6;
          const arrowX = link.target.x - Math.cos(angle) * arrowDist;
          const arrowY = link.target.y - Math.sin(angle) * arrowDist;

          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(
            arrowX - 8 * Math.cos(angle - Math.PI / 7),
            arrowY - 8 * Math.sin(angle - Math.PI / 7)
          );
          ctx.lineTo(
            arrowX - 8 * Math.cos(angle + Math.PI / 7),
            arrowY - 8 * Math.sin(angle + Math.PI / 7)
          );
          ctx.closePath();
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fill();
        }
      }

      // 2. Draw Nodes
      for (const node of nodes) {
        const isHovered = hovered?.id === node.id;
        const isConnected = hovered && connectedNodeIds.has(node.id);
        const isDimmed = hovered && !isConnected;

        // Base node color
        let nodeColor = node.category_color || '#eab308';
        if (node.type === 'reference') {
          switch (node.file_type) {
            case 'pdf':
              nodeColor = '#ef4444'; // Red
              break;
            case 'docx':
            case 'doc':
              nodeColor = '#3b82f6'; // Blue
              break;
            case 'tex':
              nodeColor = '#10b981'; // Green
              break;
            case 'mp4':
            case 'webm':
            case 'mp3':
            case 'wav':
              nodeColor = '#8b5cf6'; // Purple
              break;
            case 'pptx':
              nodeColor = '#f97316'; // Orange
              break;
            default:
              nodeColor = '#64748b'; // Slate
          }
        }

        ctx.save();
        if (isDimmed) {
          ctx.globalAlpha = 0.18;
        }

        // Outer glow on hovered node
        if (isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
          ctx.fillStyle = isDark ? 'rgba(234, 179, 8, 0.35)' : 'rgba(202, 138, 4, 0.25)';
          ctx.fill();
        }

        // Node circle or diamond (references are rounded squares / diamonds)
        ctx.beginPath();
        if (node.type === 'reference') {
          // Draw rounded box for references
          const size = node.radius * 1.8;
          const rx = node.x - size / 2;
          const ry = node.y - size / 2;
          const cr = 4;
          ctx.roundRect(rx, ry, size, size, cr);
        } else {
          // Circle for notes
          ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        }

        ctx.fillStyle = nodeColor;
        ctx.fill();

        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.strokeStyle = isHovered ? (isDark ? '#ffffff' : '#000000') : (isDark ? '#262626' : '#ffffff');
        ctx.stroke();

        // Node Icon or initial
        if (node.radius >= 12 && zoom >= 0.6) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.max(9, Math.round(node.radius * 0.7))}px system-ui, -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const symbol = node.type === 'reference' ? (node.file_type ? node.file_type.toUpperCase().substring(0, 3) : 'REF') : (node.tags && node.tags.length > 0 ? '#' : '¶');
          ctx.fillText(symbol, node.x, node.y);
        }

        // 3. Node Label / Title
        const shouldShowLabel =
          showLabels || isHovered || isConnected || zoom >= 1.2;

        if (shouldShowLabel && !isDimmed) {
          const title = node.title.length > 28 ? node.title.substring(0, 26) + '...' : node.title;
          ctx.font = isHovered
            ? '600 12px system-ui, -apple-system, sans-serif'
            : '500 11px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          const textY = node.y + node.radius + 5;

          // Draw pill background for label to ensure readable contrast
          const textMetrics = ctx.measureText(title);
          const bgWidth = textMetrics.width + 10;
          const bgHeight = 16;
          ctx.fillStyle = isDark ? 'rgba(24, 24, 27, 0.85)' : 'rgba(255, 255, 255, 0.9)';
          ctx.beginPath();
          ctx.roundRect(node.x - bgWidth / 2, textY - 2, bgWidth, bgHeight, 3);
          ctx.fill();

          ctx.fillStyle = isHovered ? (isDark ? '#eab308' : '#ca8a04') : defaultTextColor;
          ctx.fillText(title, node.x, textY);
        }

        ctx.restore();
      }

      ctx.restore();
      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      isCancelled = true;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [hoveredNode, isPhysicsActive, showLabels, runPhysicsStep]);

  // Initial fit view once nodes are loaded
  useEffect(() => {
    if (!loading && graphData.nodes.length > 0) {
      const timer = setTimeout(() => {
        handleFitView();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, graphData.nodes.length, handleFitView]);

  // Mouse coordinate translation from screen to graph world
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const relX = screenX - rect.left;
    const relY = screenY - rect.top;
    const { x: panX, y: panY, k: zoom } = transformRef.current;
    return {
      x: (relX - panX) / zoom,
      y: (relY - panY) / zoom
    };
  }, []);

  // Find node under mouse position
  const findNodeAtPos = useCallback(
    (worldX: number, worldY: number): SimNode | null => {
      const nodes = simNodesRef.current;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const dx = worldX - n.x;
        const dy = worldY - n.y;
        if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) {
          return n;
        }
      }
      return null;
    },
    []
  );

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    const clickedNode = findNodeAtPos(worldPos.x, worldPos.y);

    if (clickedNode) {
      // Start dragging node
      isDraggingNodeRef.current = clickedNode;
      clickedNode.fx = clickedNode.x;
      clickedNode.fy = clickedNode.y;
    } else {
      // Start panning canvas
      isPanningRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);

    // Node Dragging
    if (isDraggingNodeRef.current) {
      const dragged = isDraggingNodeRef.current;
      dragged.fx = worldPos.x;
      dragged.fy = worldPos.y;
      dragged.x = worldPos.x;
      dragged.y = worldPos.y;
      return;
    }

    // Canvas Panning
    if (isPanningRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      transformRef.current.x += dx;
      transformRef.current.y += dy;
      return;
    }

    // Hover detection
    const hovered = findNodeAtPos(worldPos.x, worldPos.y);
    setHoveredNode(hovered);

    if (hovered) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        setTooltipPos({
          x: e.clientX - rect.left + 15,
          y: e.clientY - rect.top + 15
        });
      }
    } else {
      setTooltipPos(null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingNodeRef.current) {
      // Release dragged node pin
      isDraggingNodeRef.current.fx = null;
      isDraggingNodeRef.current.fy = null;
      isDraggingNodeRef.current = null;
    }
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const currentK = transformRef.current.k;
    const newK = Math.min(4.0, Math.max(0.2, currentK * zoomFactor));

    // Zoom centered at cursor position
    const panX = mouseX - (mouseX - transformRef.current.x) * (newK / currentK);
    const panY = mouseY - (mouseY - transformRef.current.y) * (newK / currentK);

    transformRef.current = { x: panX, y: panY, k: newK };
    setZoomLevel(Math.round(newK * 100));
  };

  // Click on a node navigates directly to the note or reference
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    const clickedNode = findNodeAtPos(worldPos.x, worldPos.y);
    if (!clickedNode) return;

    if (clickedNode.type === 'note') {
      onSelectNote(clickedNode.id);
    } else if (clickedNode.type === 'reference') {
      onSelectReference(clickedNode.id);
    }
  };

  // Zoom Button Handlers
  const handleZoom = (direction: 'in' | 'out') => {
    const container = containerRef.current;
    if (!container) return;

    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2;
    const currentK = transformRef.current.k;
    const factor = direction === 'in' ? 1.25 : 0.8;
    const newK = Math.min(4.0, Math.max(0.2, currentK * factor));

    const panX = cx - (cx - transformRef.current.x) * (newK / currentK);
    const panY = cy - (cy - transformRef.current.y) * (newK / currentK);

    transformRef.current = { x: panX, y: panY, k: newK };
    setZoomLevel(Math.round(newK * 100));
  };

  return (
    <div
      ref={containerRef}
      className="graph-view-container"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-primary)',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      {/* Top Header & Search Bar */}
      <div
        className="graph-topbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 18px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          zIndex: 10,
          gap: 12,
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
              Grafo de Conhecimento
            </span>
            <span className="badge" style={{ fontSize: '0.72rem' }}>
              {filteredNodes.length} nós • {filteredLinks.length} conexões
            </span>
          </div>

          {/* Quick Search */}
          <div style={{ position: 'relative', width: 220 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 9,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }}
            />
            <input
              type="text"
              placeholder="Buscar nós ou tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              style={{
                width: '100%',
                padding: '5px 10px 5px 28px',
                fontSize: '0.8rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 2
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Toolbar Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Filter Toggle Button */}
          <button
            className={`toolbar-btn ${showFiltersPanel ? 'active' : ''}`}
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            title="Abrir painel de filtros do grafo"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px' }}
          >
            <Filter size={14} />
            <span style={{ fontSize: '0.8rem' }}>Filtros</span>
          </button>

          {/* Physics Play / Pause */}
          <button
            className="toolbar-btn"
            onClick={() => setIsPhysicsActive(!isPhysicsActive)}
            title={isPhysicsActive ? 'Pausar simulação física' : 'Retomar simulação física'}
            style={{ padding: '5px 8px' }}
          >
            {isPhysicsActive ? <Pause size={14} /> : <Play size={14} />}
          </button>

          {/* Zoom In */}
          <button
            className="toolbar-btn"
            onClick={() => handleZoom('in')}
            title="Aproximar (+)"
            style={{ padding: '5px 8px' }}
          >
            <ZoomIn size={14} />
          </button>

          {/* Zoom Out */}
          <button
            className="toolbar-btn"
            onClick={() => handleZoom('out')}
            title="Afastar (-)"
            style={{ padding: '5px 8px' }}
          >
            <ZoomOut size={14} />
          </button>

          {/* Fit View */}
          <button
            className="toolbar-btn"
            onClick={handleFitView}
            title="Enquadrar todos os nós na tela"
            style={{ padding: '5px 8px' }}
          >
            <Maximize2 size={14} />
          </button>

          {/* Zoom Level Indicator */}
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              minWidth: 42,
              textAlign: 'right'
            }}
          >
            {zoomLevel}%
          </span>

          {onClose && (
            <button
              className="toolbar-btn"
              onClick={onClose}
              title="Fechar visualização de grafo"
              style={{ padding: '5px 8px', marginLeft: 6 }}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Floating Filter Drawer / Panel (RF-33) */}
      {showFiltersPanel && (
        <div
          className="graph-filters-drawer"
          style={{
            position: 'absolute',
            top: 54,
            right: 18,
            width: 310,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            padding: 16,
            zIndex: 20,
            fontSize: '0.82rem',
            color: 'var(--text-primary)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: 8
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <Sliders size={15} />
              <span>Filtros do Grafo</span>
            </div>
            <button
              onClick={() => setShowFiltersPanel(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)'
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Node Type Filter */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.78rem' }}>
              Tipo de Elemento
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className={`toolbar-btn ${filterType === 'all' ? 'active' : ''}`}
                style={{ flex: 1, padding: '4px 6px', fontSize: '0.75rem' }}
                onClick={() => setFilterType('all')}
              >
                Todos
              </button>
              <button
                className={`toolbar-btn ${filterType === 'notes' ? 'active' : ''}`}
                style={{ flex: 1, padding: '4px 6px', fontSize: '0.75rem' }}
                onClick={() => setFilterType('notes')}
              >
                Notas
              </button>
              <button
                className={`toolbar-btn ${filterType === 'references' ? 'active' : ''}`}
                style={{ flex: 1, padding: '4px 6px', fontSize: '0.75rem' }}
                onClick={() => setFilterType('references')}
              >
                Fontes
              </button>
            </div>
          </div>

          {/* Category Filter */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.78rem' }}>
              Categoria
            </label>
            <select
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem'
              }}
            >
              <option value="all">Todas as Categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Degree / Density Slider (RF-33) */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6
              }}
            >
              <label style={{ fontWeight: 600, fontSize: '0.78rem' }}>
                Densidade Mínima de Conexões
              </label>
              <span style={{ fontWeight: 700, color: 'var(--primary-yellow-border)', fontSize: '0.8rem' }}>
                {minDegree}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={maxPossibleDegree}
              value={minDegree}
              onChange={(e) => setMinDegree(parseInt(e.target.value, 10))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.68rem',
                color: 'var(--text-muted)',
                marginTop: 2
              }}
            >
              <span>0 (todos)</span>
              <span>Hubs mais conectados ({maxPossibleDegree})</span>
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hideIsolated}
                onChange={(e) => setHideIsolated(e.target.checked)}
              />
              <span>Ocultar nós isolados (sem conexões)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
              />
              <span>Sempre exibir títulos dos nós</span>
            </label>
          </div>

          {/* Reset Filters */}
          <button
            className="toolbar-btn"
            onClick={() => {
              setSearchQuery('');
              setFilterType('all');
              setFilterCategoryId('all');
              setMinDegree(0);
              setHideIsolated(false);
              setShowLabels(true);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '6px 10px',
              fontSize: '0.78rem'
            }}
          >
            <RotateCcw size={13} />
            <span>Resetar Filtros</span>
          </button>
        </div>
      )}

      {/* Main Interactive Canvas */}
      <div style={{ position: 'relative', flex: 1, width: '100%', height: '100%' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onClick={handleClick}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            cursor: hoveredNode ? 'pointer' : isPanningRef.current ? 'grabbing' : 'grab'
          }}
        />

        {/* Floating Tooltip Card */}
        {hoveredNode && tooltipPos && (
          <div
            className="graph-tooltip"
            style={{
              position: 'absolute',
              left: Math.min(tooltipPos.x, (containerRef.current?.clientWidth || 800) - 240),
              top: Math.min(tooltipPos.y, (containerRef.current?.clientHeight || 600) - 140),
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
              padding: '10px 14px',
              pointerEvents: 'none',
              zIndex: 30,
              maxWidth: 260,
              fontSize: '0.8rem'
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              {hoveredNode.title}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span
                className="badge"
                style={{
                  textTransform: 'uppercase',
                  fontSize: '0.65rem',
                  backgroundColor:
                    hoveredNode.type === 'note'
                      ? 'var(--primary-yellow-light)'
                      : 'rgba(59, 130, 246, 0.15)',
                  color:
                    hoveredNode.type === 'note'
                      ? 'var(--primary-yellow-text)'
                      : '#3b82f6'
                }}
              >
                {hoveredNode.type === 'note' ? 'Anotação' : `Fonte (${hoveredNode.file_type})`}
              </span>

              {hoveredNode.category_name && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: hoveredNode.category_color || 'var(--text-muted)'
                  }}
                >
                  ● {hoveredNode.category_name}
                </span>
              )}
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>
              {hoveredNode.degree} {hoveredNode.degree === 1 ? 'conexão' : 'conexões'}
              {hoveredNode.tags && hoveredNode.tags.length > 0 && (
                <span style={{ marginLeft: 6 }}>• #{hoveredNode.tags.join(' #')}</span>
              )}
            </div>

            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--color-accent-blue)',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <ExternalLink size={11} />
              <span>Clique para abrir</span>
            </div>
          </div>
        )}

        {/* Legend Bar (Bottom Left) */}
        <div
          className="graph-legend"
          style={{
            position: 'absolute',
            bottom: 16,
            left: 18,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: '0.74rem',
            color: 'var(--text-muted)',
            zIndex: 10,
            opacity: 0.95
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: 'var(--primary-yellow-border)'
              }}
            />
            <span>Notas</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: '#ef4444'
              }}
            />
            <span>PDF</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: '#3b82f6'
              }}
            />
            <span>DOCX</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: '#10b981'
              }}
            />
            <span>TeX</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 16,
                height: 2,
                backgroundColor: 'var(--primary-yellow-border)'
              }}
            />
            <span>Wikilink</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 16,
                height: 2,
                borderTop: '2px dashed #3b82f6'
              }}
            />
            <span>Citação</span>
          </div>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              padding: '12px 20px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
              zIndex: 40
            }}
          >
            Carregando mapa do conhecimento...
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredNodes.length === 0 && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              padding: '24px 32px',
              borderRadius: '8px',
              maxWidth: 380,
              zIndex: 10
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 6 }}>
              Nenhum nó encontrado
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              Nenhuma anotação ou fonte corresponde aos filtros atuais. Tente limpar a busca ou
              reduzir o filtro de densidade.
            </p>
            <button
              className="toolbar-btn primary"
              onClick={() => {
                setSearchQuery('');
                setFilterType('all');
                setFilterCategoryId('all');
                setMinDegree(0);
                setHideIsolated(false);
              }}
              style={{ margin: '0 auto', padding: '6px 14px' }}
            >
              Limpar Filtros
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
