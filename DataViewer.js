import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Tabs, Tab, List, ListItem, ListItemAvatar,
  ListItemText, Avatar, IconButton, Tooltip, Chip, Divider,
  TextField, InputAdornment, Badge,
} from '@mui/material';
import {
  Contacts, Sms, CallLog, PhoneAndroid, Search,
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Person, CallMade, CallReceived, CallMissed, Refresh,
} from '@mui/icons-material';

/**
 * DataViewer
 *
 * Mparivahan-themed data viewer with tabs for:
 * - Contacts
 * - SMS Messages
 * - Call Logs
 *
 * Fetches data from the device via WebSocket commands.
 */
export default function DataViewer({ sendCommand, lastMessage }) {
  const [activeTab, setActiveTab] = useState(0);
  const [contacts, setContacts] = useState([]);
  const [sms, setSms] = useState([]);
  const [callLogs, setCallLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Request data on tab switch
  useEffect(() => {
    setLoading(true);
    switch (activeTab) {
      case 0:
        sendCommand('getContacts');
        break;
      case 1:
        sendCommand('getSms', { limit: 100 });
        break;
      case 2:
        sendCommand('getCallLogs', { limit: 100 });
        break;
      default:
        break;
    }
  }, [activeTab, sendCommand]);

  // Handle data from server
  useEffect(() => {
    if (!lastMessage) return;
    try {
      const data = typeof lastMessage.data === 'string'
        ? JSON.parse(lastMessage.data) : lastMessage.data;

      switch (lastMessage.type) {
        case 'contacts':
          setContacts(data);
          break;
        case 'sms':
          setSms(data);
          break;
        case 'callLogs':
          setCallLogs(data);
          break;
        default:
          break;
      }
    } catch (e) {
      console.error('Failed to parse data:', e);
    }
    setLoading(false);
  }, [lastMessage]);

  // Filter by search
  const filteredContacts = contacts.filter((c) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phones?.some((p) => p.includes(searchQuery))
  );

  const filteredSms = sms.filter((m) =>
    m.address?.includes(searchQuery) ||
    m.body?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCalls = callLogs.filter((c) =>
    c.number?.includes(searchQuery) ||
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      {/* Header */}
      <Paper sx={styles.headerCard}>
        <Box sx={styles.headerBar}>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
            Data Viewer
          </Typography>
          <Tooltip title="Refresh">
            <IconButton
              color="inherit"
              onClick={() => {
                setLoading(true);
                switch (activeTab) {
                  case 0: sendCommand('getContacts'); break;
                  case 1: sendCommand('getSms', { limit: 100 }); break;
                  case 2: sendCommand('getCallLogs', { limit: 100 }); break;
                }
              }}
            >
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => { setActiveTab(v); setSearchQuery(''); }}
          sx={{
            '& .MuiTab-root': { fontWeight: 600, textTransform: 'none' },
            '& .Mui-selected': { color: '#1565C0 !important' },
            '& .MuiTabs-indicator': { backgroundColor: '#1565C0' },
          }}
        >
          <Tab icon={<Contacts />} iconPosition="start" label={`Contacts (${contacts.length})`} />
          <Tab icon={<Sms />} iconPosition="start" label={`SMS (${sms.length})`} />
          <Tab icon={<Phone />} iconPosition="start" label={`Calls (${callLogs.length})`} />
        </Tabs>
      </Paper>

      {/* Search */}
      <Paper sx={{ mt: 2, p: 1.5, borderRadius: 3, border: '1px solid #E0E0E0' }}>
        <TextField
          fullWidth
          size="small"
          placeholder={`Search ${['contacts', 'messages', 'calls'][activeTab]}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: '#9E9E9E' }} />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      {/* Data List */}
      <Paper sx={{ mt: 2, borderRadius: 3, overflow: 'hidden', border: '1px solid #E0E0E0' }}>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#9E9E9E' }}>Loading...</Typography>
          </Box>
        ) : (
          <>
            {/* Contacts */}
            {activeTab === 0 && (
              <List dense disablePadding>
                {filteredContacts.length === 0 ? (
                  <EmptyState message="No contacts found" />
                ) : (
                  filteredContacts.map((contact, i) => (
                    <React.Fragment key={contact.id || i}>
                      <ListItem sx={styles.listItem}>
                        <ListItemAvatar>
                          <Avatar sx={{
                            bgcolor: stringToColor(contact.name || '?'),
                            width: 40, height: 40,
                            fontSize: '0.9rem', fontWeight: 600,
                          }}>
                            {(contact.name || '?')[0]?.toUpperCase()}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={contact.name}
                          secondary={
                            <Box component="span">
                              {contact.phones?.map((phone, j) => (
                                <Typography key={j} variant="caption" component="span" display="block"
                                  sx={{ color: '#424242' }}>
                                  📱 {phone}
                                </Typography>
                              ))}
                              {contact.emails?.map((email, j) => (
                                <Typography key={j} variant="caption" component="span" display="block"
                                  sx={{ color: '#757575' }}>
                                  ✉️ {email}
                                </Typography>
                              ))}
                            </Box>
                          }
                          primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }}
                        />
                        {contact.phones?.length > 0 && (
                          <Tooltip title="Call">
                            <IconButton size="small" sx={{ color: '#2E7D32' }}>
                              <Phone fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </ListItem>
                      {i < filteredContacts.length - 1 && <Divider component="li" sx={{ ml: 7 }} />}
                    </React.Fragment>
                  ))
                )}
              </List>
            )}

            {/* SMS */}
            {activeTab === 1 && (
              <List dense disablePadding>
                {filteredSms.length === 0 ? (
                  <EmptyState message="No messages found" />
                ) : (
                  filteredSms.map((msg, i) => (
                    <React.Fragment key={msg.id || i}>
                      <ListItem sx={styles.listItem}>
                        <ListItemAvatar>
                          <Avatar sx={{
                            bgcolor: msg.type === 'sent' ? '#E3F2FD' : '#E8F5E9',
                            width: 40, height: 40,
                          }}>
                            {msg.type === 'sent'
                              ? <CallMade sx={{ color: '#1565C0', fontSize: 18 }} />
                              : <CallReceived sx={{ color: '#2E7D32', fontSize: 18 }} />
                            }
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {msg.address}
                              </Typography>
                              <Chip
                                label={msg.type}
                                size="small"
                                sx={{
                                  height: 18, fontSize: '0.6rem',
                                  backgroundColor: msg.type === 'sent' ? '#E3F2FD' : '#E8F5E9',
                                  color: msg.type === 'sent' ? '#1565C0' : '#2E7D32',
                                }}
                              />
                              {!msg.read && (
                                <Box sx={{
                                  width: 8, height: 8, borderRadius: '50%',
                                  backgroundColor: '#FF6F00',
                                }} />
                              )}
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" sx={{ color: '#424242' }}>
                              {msg.body}
                            </Typography>
                          }
                        />
                        <Typography variant="caption" sx={{ color: '#9E9E9E', whiteSpace: 'nowrap' }}>
                          {formatTimestamp(msg.date)}
                        </Typography>
                      </ListItem>
                      {i < filteredSms.length - 1 && <Divider component="li" sx={{ ml: 7 }} />}
                    </React.Fragment>
                  ))
                )}
              </List>
            )}

            {/* Call Logs */}
            {activeTab === 2 && (
              <List dense disablePadding>
                {filteredCalls.length === 0 ? (
                  <EmptyState message="No call logs found" />
                ) : (
                  filteredCalls.map((call, i) => (
                    <React.Fragment key={call.id || i}>
                      <ListItem sx={styles.listItem}>
                        <ListItemAvatar>
                          <Avatar sx={{
                            bgcolor: callTypeColor(call.type),
                            width: 40, height: 40,
                          }}>
                            {callTypeIcon(call.type)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {call.name || call.number}
                              </Typography>
                              <Chip
                                label={call.type}
                                size="small"
                                sx={{
                                  height: 18, fontSize: '0.6rem',
                                  backgroundColor: callTypeColor(call.type) + '22',
                                  color: callTypeColor(call.type),
                                }}
                              />
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" sx={{ color: '#757575' }}>
                              {call.number} — {call.duration > 0 ? formatDuration(call.duration) : 'No duration'}
                            </Typography>
                          }
                        />
                        <Typography variant="caption" sx={{ color: '#9E9E9E', whiteSpace: 'nowrap' }}>
                          {formatTimestamp(call.date)}
                        </Typography>
                      </ListItem>
                      {i < filteredCalls.length - 1 && <Divider component="li" sx={{ ml: 7 }} />}
                    </React.Fragment>
                  ))
                )}
              </List>
            )}
          </>
        )}
      </Paper>
    </Box>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function EmptyState({ message }) {
  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Contacts sx={{ fontSize: 48, color: '#BDBDBD', mb: 1 }} />
      <Typography variant="body2" sx={{ color: '#9E9E9E' }}>{message}</Typography>
    </Box>
  );
}

function callTypeIcon(type) {
  switch (type) {
    case 'incoming': return <PhoneIncoming sx={{ fontSize: 18, color: '#fff' }} />;
    case 'outgoing': return <PhoneOutgoing sx={{ fontSize: 18, color: '#fff' }} />;
    case 'missed': return <PhoneMissed sx={{ fontSize: 18, color: '#fff' }} />;
    default: return <Phone sx={{ fontSize: 18, color: '#fff' }} />;
  }
}

function callTypeColor(type) {
  switch (type) {
    case 'incoming': return '#2E7D32';
    case 'outgoing': return '#1565C0';
    case 'missed': return '#C62828';
    default: return '#757575';
  }
}

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#1565C0', '#C62828', '#2E7D32', '#FF6F00', '#6A1B9A', '#00838F', '#4E342E'];
  return colors[Math.abs(hash) % colors.length];
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDuration(secs) {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
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
  listItem: {
    py: 1.5,
    px: 2,
    '&:hover': { backgroundColor: '#F5F5F5' },
  },
};
