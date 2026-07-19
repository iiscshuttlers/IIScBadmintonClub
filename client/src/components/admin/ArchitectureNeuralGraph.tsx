import { useMemo, useEffect, useState, useRef } from "react";
import dbSchema from "@/data/dbSchemaData.json";
// @ts-ignore - no types available for this specific package version by default in this environment, or we can just ignore it
import ForceGraph2D from "react-force-graph-2d";
import { BrainCircuit, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { InfoModal } from "@/components/InfoModal";

const TABLE_TO_FEATURES: Record<string, string[]> = {
  "admin_history": ["Activity Logs", "Site Admin Control Center"],
  "club_courts": ["Live Courts Dashboard", "Venue & Presence Tracking"],
  "doubles_teams": ["Doubles Match Logging", "Doubles Pair Profiles"],
  "live_match_votes": ["Pulse (Social Feed)", "Live Matches"],
  "marketplace_listings": ["Club Marketplace", "Equipment Exchange"],
  "match_health_data": ["Player Health & Biometrics", "Danger Zone Heart Rate Haptics"],
  "match_motion_stats": ["Pocket Mode Motion Tracking", "Hardware Motion Tracking"],
  "match_player_paths": ["AR 3D Replays", "Path Tracing Wizard", "Shuttlecock Optical Tracking"],
  "match_rally_stats": ["Match Analytics", "Auto-Highlights Engine"],
  "match_sensor_analytics": ["Sensor Lab", "AI Stroke Breakdown"],
  "match_stroke_analytics": ["AI Stroke Breakdown & Coaching"],
  "match_video_calibration": ["Path Tracing Wizard"],
  "player_endorsements": ["Player Profiles", "Teams & Endorsements"],
  "player_sleep_data": ["Player Health & Biometrics"],
  "recycle_bin": ["Site Admin Control Center", "Recycle Bin"],
  "tournaments": ["Tournament Management", "Live Tournaments & Brackets"],
  "tournament_matches": ["Tournament Management", "Live Scoring"],
  "tournament_participants": ["Tournament Management"],
  "tournament_round_rules": ["Tournament Management", "Bracket Generation"],
  "umpire_assignments": ["Umpire Mode"],
  "venue_presence_events": ["Venue Tracking", "Gymkhana Geofence"]
};

export function ArchitectureNeuralGraph() {
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Parse nodes and links
  const graphData = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];
    const featureSet = new Set<string>();

    Object.entries(TABLE_TO_FEATURES).forEach(([tableName, features]) => {
      // Add table node
      nodes.push({
        id: tableName,
        name: tableName,
        group: "table",
        val: 15,
        color: "#38BDF8"
      });

      features.forEach(feature => {
        // Add feature node if it doesn't exist
        if (!featureSet.has(feature)) {
          featureSet.add(feature);
          nodes.push({
            id: feature,
            name: feature,
            group: "feature",
            val: 8,
            color: "#4BB988"
          });
        }

        // Add link
        links.push({
          source: tableName,
          target: feature
        });
      });
    });

    return { nodes, links };
  }, []);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: isFullscreen ? window.innerHeight : 650
        });
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const recenter = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 50);
    }
  };

  return (
    <div 
      className={`w-full bg-[#0A1118] text-[#E2E8F0] font-sans ${
        isFullscreen ? 'fixed inset-0 z-[100] p-0' : 'min-h-[calc(100vh-4rem)] p-6 md:p-10'
      }`}
    >
      <div className={`mx-auto flex flex-col h-full ${isFullscreen ? 'w-full h-screen' : 'max-w-7xl'}`}>
        
        {/* Header Section */}
        {!isFullscreen && (
          <div className="mb-6">
            <div className="text-[0.72rem] font-bold tracking-[0.14em] uppercase text-[#F0965A] mb-2 flex items-center gap-2">
              <BrainCircuit className="w-4 h-4" /> Codebase Neural Map
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-white flex items-center gap-2">
              Architecture Visualization
              <InfoModal
                title="ARCHITECTURE GRAPH"
                items={[
                  { badge: "USAGE", title: "How to use", desc: "An interactive web graph. Click and drag nodes to watch the physics engine react, and zoom in/out to explore relationships between Frontend Features and Backend Database Tables." },
                  { badge: "LOGIC", title: "How it works", desc: "Uses react-force-graph-2d and d3-force. It transforms TABLE_TO_FEATURES into nodes and links, applying repelling forces to spread nodes and spring forces to connect features." }
                ]}
              />
            </h1>
            <p className="text-[#94A3B8] text-sm max-w-2xl leading-relaxed">
              An interactive force-directed graph mapping the backend database tables (blue nodes) to the frontend app features (green nodes) that rely on them. Drag nodes to explore relationships.
            </p>
          </div>
        )}

        {/* Graph Container */}
        <div 
          ref={containerRef}
          className={`relative bg-[#0F172A] border border-[#1E293B] rounded-xl overflow-hidden shadow-2xl flex-1 ${
            isFullscreen ? 'border-0 rounded-none' : 'min-h-[650px]'
          }`}
        >
          {/* Floating Controls */}
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button 
              onClick={recenter}
              className="p-2 bg-[#1E293B]/80 hover:bg-[#334155] backdrop-blur-md rounded-lg text-[#94A3B8] hover:text-white transition-colors border border-[#334155]"
              title="Recenter Camera"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button 
              onClick={toggleFullscreen}
              className="p-2 bg-[#1E293B]/80 hover:bg-[#334155] backdrop-blur-md rounded-lg text-[#94A3B8] hover:text-white transition-colors border border-[#334155]"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>

          <div className="absolute top-4 left-4 z-10 bg-[#1E293B]/80 backdrop-blur-md px-3 py-2 rounded-lg border border-[#334155] text-xs font-mono shadow-lg">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8] shadow-[0_0_8px_#38BDF8]"></span>
                <span className="text-[#E2E8F0]">Database Table</span>
              </div>
              <div className="flex items-center gap-1.5 ml-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4BB988] shadow-[0_0_8px_#4BB988]"></span>
                <span className="text-[#E2E8F0]">App Feature</span>
              </div>
            </div>
          </div>

          <ForceGraph2D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeLabel="name"
            nodeColor="color"
            nodeRelSize={6}
            linkColor={() => '#334155'}
            linkWidth={1.5}
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={0.005}
            backgroundColor="#0F172A"
            onNodeClick={(node: any) => {
              // Center/zoom on node
              if (fgRef.current) {
                fgRef.current.centerAt(node.x, node.y, 1000);
                fgRef.current.zoom(4, 2000);
              }
            }}
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              const label = node.name;
              const fontSize = node.group === 'table' ? 14/globalScale : 12/globalScale;
              
              // Draw Node
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
              ctx.fillStyle = node.color;
              ctx.fill();
              
              // Draw Glow
              ctx.shadowBlur = 10;
              ctx.shadowColor = node.color;
              
              // Text
              ctx.font = `bold ${fontSize}px Inter, Sans-Serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = node.group === 'table' ? '#F8FAFC' : '#CBD5E1';
              // Draw text below node
              ctx.fillText(label, node.x, node.y + node.val + (8/globalScale));
              
              // Reset shadow
              ctx.shadowBlur = 0;
            }}
          />
        </div>
      </div>
    </div>
  );
}
