import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import { ProjectList } from "./components/ProjectList";
import { FileTree } from "./components/FileTree";
import { EditorPane } from "./components/EditorPane";
import { TerminalPane } from "./components/TerminalPane";
import "./App.css";

function ResizeHandle() {
  return (
    <Separator
      className="w-1 bg-zinc-700 hover:bg-zinc-600 transition-colors cursor-col-resize data-[active]:bg-zinc-500"
    />
  );
}

function App() {
  // Persist panel sizes across restarts
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "agent-station-layout",
    storage: localStorage,
  });

  return (
    <div className="h-screen w-screen bg-zinc-900">
      <Group
        orientation="horizontal"
        className="h-full"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        {/* Projects Panel */}
        <Panel
          id="projects"
          defaultSize="15%"
          minSize="10%"
          maxSize="25%"
          className="min-w-[150px]"
        >
          <ProjectList />
        </Panel>

        <ResizeHandle />

        {/* File Tree Panel */}
        <Panel
          id="filetree"
          defaultSize="17%"
          minSize="12%"
          maxSize="30%"
          className="min-w-[200px]"
        >
          <FileTree />
        </Panel>

        <ResizeHandle />

        {/* Editor Panel */}
        <Panel
          id="editor"
          defaultSize="40%"
          minSize="20%"
          className="min-w-[300px]"
        >
          <EditorPane />
        </Panel>

        <ResizeHandle />

        {/* Terminal Panel */}
        <Panel
          id="terminal"
          defaultSize="28%"
          minSize="20%"
          maxSize="50%"
          className="min-w-[300px]"
        >
          <TerminalPane />
        </Panel>
      </Group>
    </div>
  );
}

export default App;
