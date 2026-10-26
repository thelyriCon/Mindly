import React, { useEffect, useRef, useState, useId } from 'react';
import mermaid from 'mermaid';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Network,
  ArrowRight,
} from 'lucide-react';
import { LessonDiagram } from '../types';
import { useTheme } from '../hooks/useTheme';

const configureMermaidTheme = (isLight: boolean) => {
  mermaid.initialize({
    startOnLoad: false,
    suppressErrorRendering: true,
    theme: isLight ? 'default' : 'dark',
    securityLevel: 'loose',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    themeVariables: isLight
      ? {
          darkMode: false,
          background: '#ffffff',
          primaryColor: '#e0f2fe',
          primaryTextColor: '#0f172a',
          primaryBorderColor: '#0284c7',
          lineColor: '#0284c7',
          secondaryColor: '#f8fafc',
          tertiaryColor: '#f1f5f9',
        }
      : {
          darkMode: true,
          background: '#0e0f12',
          primaryColor: '#1e293b',
          primaryTextColor: '#f8fafc',
          primaryBorderColor: '#38bdf8',
          lineColor: '#00B4FF',
          secondaryColor: '#0f172a',
          tertiaryColor: '#1e1b4b',
        },
  });
};

// Initial default configuration
configureMermaidTheme(false);

interface DiagramViewerProps {
  diagrams: LessonDiagram[];
}

export const DiagramViewer: React.FC<DiagramViewerProps> = ({ diagrams }) => {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!diagrams || diagrams.length === 0) return null;

  const currentDiagram = diagrams[activeIdx] || diagrams[0];

  return (
    <div className="p-6 rounded-2xl bg-[#131418] border border-[#23252e] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center text-[#00B4FF]">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
              Interactive Concept Diagram
            </h2>
            <p className="text-[11px] text-zinc-400">
              Visual concept architecture and structural relationships
            </p>
          </div>
        </div>

        {/* Multi-diagram selector tabs */}
        {diagrams.length > 1 && (
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0e0f12] border border-[#1f2027]">
            {diagrams.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIdx(i)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeIdx === i
                    ? 'bg-[#00B4FF]/20 text-[#00B4FF] border border-[#00B4FF]/40'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Concept {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Render Active Diagram */}
      <SingleDiagramCard diagram={currentDiagram} key={`${activeIdx}-${currentDiagram.title}`} />
    </div>
  );
};

interface SingleDiagramCardProps {
  diagram: LessonDiagram;
}

/**
 * Parses node steps from diagram definition for a clean fallback representation
 */
function extractConceptSteps(code: string): string[] {
  const steps: string[] = [];
  // Match quoted text inside brackets: ["Text"] or standard node text: [Text]
  const regex = /\["([^"]+)"\]|\[([^[\]]+)\]/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    const text = (match[1] || match[2] || '').trim();
    if (text && !steps.includes(text) && text.length > 1 && !text.startsWith('fa-')) {
      steps.push(text);
    }
  }
  return steps;
}

const SingleDiagramCard: React.FC<SingleDiagramCardProps> = ({ diagram }) => {
  const { isLight } = useTheme();
  const rawId = useId();
  const cleanId = `diag-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [hasRenderError, setHasRenderError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Clean any stray mermaid error nodes that might have been injected
  const purgeStrayMermaidErrors = () => {
    try {
      const stray = document.querySelectorAll(
        `[id^="dmermaid"], [id^="mermaid-"], .error-icon, .mermaid-error, [id^="d${cleanId}"]`
      );
      stray.forEach((el) => {
        // Only remove if it contains syntax error text or is detached
        if (el.textContent?.includes('Syntax error') || el.classList.contains('error-icon')) {
          el.remove();
        }
      });
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    configureMermaidTheme(isLight);
    let isMounted = true;
    setHasRenderError(false);
    setSvgHtml('');
    purgeStrayMermaidErrors();

    const renderDiagram = async () => {
      try {
        let code = diagram.mermaidCode.trim();
        // Remove markdown backticks if present
        code = code.replace(/^```(?:mermaid)?\n?/, '').replace(/\n?```$/, '').trim();

        // Check for basic diagram directive
        if (!/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|timeline|mindmap)/i.test(code)) {
          code = `flowchart TD\n${code}`;
        }

        const { svg } = await mermaid.render(cleanId, code);
        if (isMounted) {
          setSvgHtml(svg);
          setHasRenderError(false);
        }
      } catch (err: any) {
        console.warn('[CONCEPT DIAGRAM NOTICE]', err?.message || 'Rendering fallback mode');
        purgeStrayMermaidErrors();
        if (isMounted) {
          setHasRenderError(true);
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
      purgeStrayMermaidErrors();
    };
  }, [diagram.mermaidCode, cleanId, isLight]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 2.5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.5));
  const handleResetZoom = () => setZoom(1);

  const fallbackSteps = extractConceptSteps(diagram.mermaidCode);

  return (
    <div
      className={`rounded-xl border border-[#1f2027] bg-[#0a0b0e] overflow-hidden transition-all ${
        isFullscreen
          ? 'fixed inset-4 z-50 p-6 flex flex-col shadow-2xl bg-[#0a0b0e]/95 backdrop-blur-md'
          : 'p-4 sm:p-5'
      }`}
    >
      {/* Header with Title and Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1f2027]">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>{diagram.title}</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{diagram.caption}</p>
        </div>

        {/* Clean Student Toolbar */}
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
          {!hasRenderError && (
            <>
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1.5 rounded-lg bg-[#14161c] border border-[#23252e] text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-zinc-400 px-1 min-w-[36px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1.5 rounded-lg bg-[#14161c] border border-[#23252e] text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 rounded-lg bg-[#14161c] border border-[#23252e] text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-[#14161c] border border-[#23252e] text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Diagram Canvas */}
      <div
        className={`relative overflow-auto rounded-lg bg-[#07080a] border border-[#161820] mt-3 flex items-center justify-center p-4 sm:p-6 transition-all ${
          isFullscreen ? 'flex-1 min-h-0' : 'min-h-[240px] max-h-[500px]'
        }`}
      >
        {hasRenderError ? (
          /* Graceful Visual Fallback: Clean Concept Flow without any error popups or tech jargon */
          <div className="w-full max-w-xl p-5 space-y-4 text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              <Network className="w-4 h-4" />
              <span>Concept Sequence & Relationships</span>
            </div>

            {fallbackSteps.length > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {fallbackSteps.map((step, idx) => (
                  <React.Fragment key={idx}>
                    <div className="px-3.5 py-2 rounded-xl bg-[#14161f] border border-[#252837] text-xs font-medium text-zinc-200 shadow-sm">
                      {step}
                    </div>
                    {idx < fallbackSteps.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-[#00B4FF] shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                {diagram.caption}
              </p>
            )}

            <p className="text-[11px] text-zinc-500 italic">
              {diagram.caption}
            </p>
          </div>
        ) : svgHtml ? (
          <div
            ref={containerRef}
            className="w-full flex justify-center items-center transition-transform duration-100 ease-out origin-center"
            style={{ transform: `scale(${zoom})` }}
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        ) : (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-[#00B4FF] animate-ping" />
            <span>Rendering concept diagram...</span>
          </div>
        )}
      </div>
    </div>
  );
};
