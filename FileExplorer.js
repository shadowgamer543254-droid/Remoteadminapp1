import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, List, ListItemButton, ListItemIcon, ListItemText,
  Breadcrumbs, IconButton, Tooltip, Button, Chip, Divider,
  LinearProgress,
} from '@mui/material';
import {
  Folder, InsertDriveFile, ArrowBack, Refresh, Download, Upload,
  Delete, NavigateNext, Home, Image, Audiotrack, VideoFile,
  Description, Archive, Code, Storage,
} from '@mui/icons-material';

/**
 * FileExplorer
 *
 * Mparivahan-themed file browser that lets the remote operator
 * navigate the device filesystem, view file details, and
 * upload/download files.
 */
export default function FileExplorer({ sendCommand, lastMessage }) {
  const [currentPath, setCurrentPath] = useState('/sdcard/');
  const [parentPath, setParentPath] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Request files when path changes
  useEffect(() => {
    setLoading(true);
    sendCommand('getFiles', { path: currentPath });
  }, [currentPath, sendCommand]);

  // Handle file data from server
  useEffect(() => {
    if (lastMessage?.type === 'files') {
      try {
        const data = typeof lastMessage.data === 'string'
          ? JSON.parse(lastMessage.data) : lastMessage.data;
        setFiles(data.files || []);
        setCurrentPath(data.currentPath || currentPath);
        setParentPath(data.parentPath);
      } catch (e) {
        console.error('Failed to parse file data:', e);
      }
      setLoading(false);
    }
  }, [lastMessage]);

  const navigateTo = (path) => {
    setCurrentPath(path);
    setSelectedFile(null);
  };

  const navigateUp = () => {
    if (parentPath) navigateTo(parentPath);
  };

  const handleDownload = (filePath) => {
    sendCommand('downloadFile', { path: filePath });
  };

  const handleDelete = (filePath) => {
    if (window.confirm(`Delete ${filePath}?`)) {
      sendCommand('deleteFile', { path: filePath });
    }
  };

  // Build breadcrumbs from path
  const pathParts = currentPath.split('/').filter(Boolean);

  // Sort: directories first, then files
  const sortedFiles = [...files].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {/* Header */}
      <Paper sx={styles.headerCard}>
        <Box sx={styles.headerBar}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Storage sx={{ color: '#FFD54F' }} />
            <Typography variant="h6" sx={{ color: '#0D47A1', fontWeight: 700 }}>
              File Explorer
            </Typography>
          </Box>
          <Box>
            <Tooltip title="Go Up">
              <span>
                <IconButton onClick={navigateUp} disabled={!parentPath}>
                  <ArrowBack />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={() => sendCommand('getFiles', { path: currentPath })}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Breadcrumbs */}
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Breadcrumbs separator={<NavigateNext fontSize="small" />} sx={{ fontSize: '0.8rem' }}>
            <Typography
              component="span"
              sx={{
                cursor: 'pointer',
                color: '#1565C0',
                fontWeight: 600,
                '&:hover': { textDecoration: 'underline' },
              }}
              onClick={() => navigateTo('/')}
            >
              <Home sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
              root
            </Typography>
            {pathParts.map((part, i) => {
              const path = '/' + pathParts.slice(0, i + 1).join('/') + '/';
              return (
                <Typography
                  key={i}
                  component="span"
                  sx={{
                    cursor: 'pointer',
                    color: i === pathParts.length - 1 ? '#0D47A1' : '#1565C0',
                    fontWeight: i === pathParts.length - 1 ? 700 : 400,
                    '&:hover': { textDecoration: 'underline' },
                  }}
                  onClick={() => navigateTo(path)}
                >
                  {part}
                </Typography>
              );
            })}
          </Breadcrumbs>
        </Box>
      </Paper>

      {loading && <LinearProgress sx={{ borderRadius: 2, mt: 1 }} />}

      {/* File List */}
      <Paper sx={{ mt: 2, borderRadius: 3, overflow: 'hidden', border: '1px solid #E0E0E0' }}>
        {sortedFiles.length === 0 && !loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Folder sx={{ fontSize: 48, color: '#BDBDBD', mb: 1 }} />
            <Typography variant="body2" sx={{ color: '#9E9E9E' }}>
              {files.length === 0 ? 'Empty directory' : 'No files found'}
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {sortedFiles.map((file, i) => (
              <React.Fragment key={file.path}>
                <ListItemButton
                  selected={selectedFile?.path === file.path}
                  onClick={() => {
                    if (file.isDirectory) {
                      navigateTo(file.path);
                    } else {
                      setSelectedFile(selectedFile?.path === file.path ? null : file);
                    }
                  }}
                  sx={styles.fileItem}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {file.isDirectory ? (
                      <Folder sx={{ color: '#FF6F00' }} />
                    ) : (
                      <FileIcon name={file.name} />
                    )}
                  </ListItemIcon>

                  <ListItemText
                    primary={file.name}
                    secondary={file.isDirectory
                      ? `${file.childCount || 0} items`
                      : formatSize(file.size)}
                    primaryTypographyProps={{
                      fontWeight: 500,
                      fontSize: '0.85rem',
                      noWrap: true,
                    }}
                    secondaryTypographyProps={{
                      fontSize: '0.7rem',
                      color: '#9E9E9E',
                    }}
                  />

                  {!file.isDirectory && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Download">
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); handleDownload(file.path); }}
                          sx={{ color: '#1565C0' }}
                        >
                          <Download fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); handleDelete(file.path); }}
                          sx={{ color: '#C62828' }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </ListItemButton>

                {i < sortedFiles.length - 1 && (
                  <Divider component="li" sx={{ ml: 5 }} />
                )}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* Selected file detail card */}
      {selectedFile && !selectedFile.isDirectory && (
        <Paper sx={{ mt: 2, p: 2, borderRadius: 3, border: '1px solid #E0E0E0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {selectedFile.name}
              </Typography>
              <Typography variant="caption" sx={{ color: '#757575' }}>
                {selectedFile.path} — {formatSize(selectedFile.size)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="contained"
                startIcon={<Download />}
                onClick={() => handleDownload(selectedFile.path)}
              >
                Download
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<Delete />}
                onClick={() => handleDelete(selectedFile.path)}
              >
                Delete
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Upload button */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Button
          variant="outlined"
          startIcon={<Upload />}
          sx={{
            borderColor: '#1565C0',
            color: '#1565C0',
            '&:hover': { borderColor: '#0D47A1', backgroundColor: '#E3F2FD' },
          }}
          component="label"
        >
          Upload File to {currentPath}
          <input type="file" hidden onChange={(e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              sendCommand('uploadFile', {
                path: currentPath + file.name,
                data: Array.from(new Uint8Array(reader.result)),
              });
            };
            reader.readAsArrayBuffer(file);
          }} />
        </Button>
      </Box>
    </Box>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function FileIcon({ name }) {
  const ext = name.split('.').pop()?.toLowerCase();
  const iconMap = {
    jpg: <Image sx={{ color: '#4CAF50' }} />,
    jpeg: <Image sx={{ color: '#4CAF50' }} />,
    png: <Image sx={{ color: '#4CAF50' }} />,
    gif: <Image sx={{ color: '#4CAF50' }} />,
    mp3: <Audiotrack sx={{ color: '#E91E63' }} />,
    wav: <Audiotrack sx={{ color: '#E91E63' }} />,
    mp4: <VideoFile sx={{ color: '#9C27B0' }} />,
    mkv: <VideoFile sx={{ color: '#9C27B0' }} />,
    txt: <Description sx={{ color: '#2196F3' }} />,
    pdf: <Description sx={{ color: '#F44336' }} />,
    zip: <Archive sx={{ color: '#FF9800' }} />,
    rar: <Archive sx={{ color: '#FF9800' }} />,
    apk: <InsertDriveFile sx={{ color: '#2E7D32' }} />,
    json: <Code sx={{ color: '#FF6F00' }} />,
    xml: <Code sx={{ color: '#FF6F00' }} />,
  };
  return iconMap[ext] || <InsertDriveFile sx={{ color: '#757575' }} />;
}

function formatSize(bytes) {
  if (bytes == null || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

const styles = {
  headerCard: {
    borderRadius: 3,
    overflow: 'hidden',
    border: '1px solid #E0E0E0',
  },
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    px: 2,
    py: 1.5,
    background: 'linear-gradient(135deg, #0D47A1, #1565C0)',
    borderBottom: '3px solid #FF6F00',
  },
  fileItem: {
    py: 1,
    px: 2,
    '&:hover': { backgroundColor: '#F5F5F5' },
  },
};
