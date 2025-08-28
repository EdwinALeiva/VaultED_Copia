// src/components/FileTree.jsx
import React, { useState } from 'react';
import {
  ChevronRight as ChevronRightIcon,
  ChevronDown as ChevronDownIcon,
  Folder as FolderIcon
} from 'lucide-react';

/**
 * Recursive FileTree component
 * Props:
 * - nodes: array of { id, name, type: 'file'|'folder', children? }
 * - onSelectFolder: callback(folderNode) when user clicks a folder
 * - activeId: id of the active folder to highlight
 * - onContextMenuFolder: (node, event) -> void, called on right-click of a folder
 */
export default function FileTree({ nodes, onSelectFolder, activeId, onContextMenuFolder, onRequestRenameFolder }) {
  return (
    <ul className="pl-2">
  {(nodes || []).filter(n => n.type === 'folder').map((node) => {
        const nodeKey = node.id ?? node.path ?? node.name; // robust unique key fallback
        return (
          <TreeNode
            key={nodeKey}
            node={node}
            onSelectFolder={onSelectFolder}
            activeId={activeId}
            onContextMenuFolder={onContextMenuFolder}
            onRequestRenameFolder={onRequestRenameFolder}
          />
        );
      })}
    </ul>
  );
}

function TreeNode({ node, onSelectFolder, activeId, onContextMenuFolder, onRequestRenameFolder }) {
  const [expanded, setExpanded] = useState(false);
  const isFolder = node.type === 'folder';
  const nodeKey = node.id ?? node.path ?? node.name; // derive stable identity
  const isActive = nodeKey === activeId;

  // Do not render file nodes in the tree; left panel is folders-only
  if (!isFolder) return null;

  const handleClick = () => {
    if (isFolder) {
      setExpanded((e) => !e);
      // ensure caller receives an object with an id for active tracking
      onSelectFolder(node.id ? node : { ...node, id: nodeKey });
    }
  };

  const handleContextMenu = (e) => {
    if (!isFolder) return;
    if (onContextMenuFolder) {
      e.preventDefault();
      onContextMenuFolder(node, e);
    }
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (onRequestRenameFolder) onRequestRenameFolder(node);
  };

  return (
  <li className="select-none">
    <div
  className={`flex items-center cursor-pointer p-1 rounded ${isActive ? 'bg-blue-100 text-blue-800 font-medium' : 'hover:bg-gray-100'}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
      >
        {expanded ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
        <span className="ml-1">
          {isFolder ? <FolderIcon size={16} /> : null}
        </span>
  <span className="ml-1 text-xs truncate">{node.name}</span>
      </div>
      {expanded && node.children && (
        <FileTree
          nodes={(node.children || []).filter(n => n.type === 'folder')}
          onSelectFolder={onSelectFolder}
          activeId={activeId}
          onContextMenuFolder={onContextMenuFolder}
        />
      )}
    </li>
  );
}
