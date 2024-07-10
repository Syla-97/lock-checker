import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styled, { createGlobalStyle } from 'styled-components';
import { AppBar, Tabs, Tab, Box, Typography, IconButton, TextField } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { LocalizationProvider, DatePicker } from '@mui/lab';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import { ja } from 'date-fns/locale';

const GlobalStyle = createGlobalStyle`
  body {
    font-family: 'Arial', sans-serif;
    background-color: #f4f4f9;
    color: #333;
    margin: 0;
    padding: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
  }
`;

const AppContainer = styled.div`
  text-align: center;
  background: #fff;
  padding: 40px;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h1`
  font-size: 2.5rem;
  margin-bottom: 20px;
`;

const Status = styled.div`
  font-size: 1.5rem;
  margin-bottom: 20px;
  padding: 10px;
  border: 2px solid ${props => (props.locked ? '#4caf50' : '#f44336')};
  border-radius: 5px;
  color: ${props => (props.locked ? '#4caf50' : '#f44336')};
`;

const Button = styled.button`
  font-size: 1rem;
  margin: 10px;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  color: #fff;
  background-color: ${props => (props.primary ? '#4caf50' : '#f44336')};
  &:hover {
    background-color: ${props => (props.primary ? '#45a049' : '#e53935')};
  }
`;

const List = styled.ul`
  text-align: left;
`;

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box p={3}>
          <Typography>{children}</Typography>
        </Box>
      )}
    </div>
  );
}

function App() {
  const [lockStatus, setLockStatus] = useState(null);
  const [history, setHistory] = useState(JSON.parse(localStorage.getItem('history')) || []);
  const [displayHistory, setDisplayHistory] = useState([]);
  const [log, setLog] = useState([]);
  const [value, setValue] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    axios.get('http://localhost:3001/status')
      .then(response => {
        setLockStatus(response.data.status);
      })
      .catch(error => {
        console.error('There was an error fetching the lock status!', error);
      });

    fetchHistory();
  }, []);

  const fetchHistory = () => {
    const localHistory = JSON.parse(localStorage.getItem('history')) || [];
    setHistory(localHistory);
    setDisplayHistory(localHistory);
  };

  const fetchLog = () => {
    axios.get('http://localhost:3001/log')
      .then(response => {
        const formattedLog = response.data.log.map(entry => {
          const [utcTimestamp, jstPart] = entry.split(' (JST: ');
          const jstTimestamp = jstPart.split(') - ')[0];
          const status = entry.endsWith('Locked') ? 'Locked' : 'Unlocked';
          const formattedJST = new Date(jstTimestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
          return `${formattedJST} - ${status}`;
        });
        setLog(formattedLog);
      })
      .catch(error => {
        console.error('There was an error fetching the log!', error);
      });
  };

  const handleLock = () => {
    setLockStatus(true);
    axios.post('http://localhost:3001/status', { status: true })
      .then(response => {
        console.log(response.data.message);
        addHistory(true); // 履歴に追加
        fetchLog(); // ログを再取得
      })
      .catch(error => {
        console.error('There was an error updating the lock status!', error);
      });
  };

  const handleUnlock = () => {
    setLockStatus(false);
    axios.post('http://localhost:3001/status', { status: false })
      .then(response => {
        console.log(response.data.message);
        addHistory(false); // 履歴に追加
        fetchLog(); // ログを再取得
      })
      .catch(error => {
        console.error('There was an error updating the lock status!', error);
      });
  };

  const addHistory = (status) => {
    const newEntry = {
      status: status,
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }).replace(/\//g, '-').replace(' ', 'T')
    };
    const updatedHistory = [newEntry, ...history];
    setHistory(updatedHistory);
    setDisplayHistory(updatedHistory);
    localStorage.setItem('history', JSON.stringify(updatedHistory));
  };

  const handleChange = (event, newValue) => {
    setValue(newValue);
    if (newValue === 2) {
      fetchLog(); // ログタブを表示する際にログを取得
    }
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    const selectedDateString = date.toISOString().split('T')[0];
    const filteredHistory = history.filter(entry => entry.timestamp.startsWith(selectedDateString));
    setDisplayHistory(filteredHistory);
  };

  const clearDisplayHistory = () => {
    setDisplayHistory([]); // ディスプレイ用の履歴をクリア
    setHistory([]);
    localStorage.removeItem('history'); // ローカルストレージの履歴を削除
  };

  return (
    <>
      <GlobalStyle />
      <AppContainer>
        <AppBar position="static">
          <Tabs value={value} onChange={handleChange} aria-label="simple tabs example">
            <Tab label="Status" />
            <Tab label="History" />
            <Tab label="Log" />
          </Tabs>
        </AppBar>
        <TabPanel value={value} index={0}>
          <Title>Lock Checker</Title>
          <Status locked={lockStatus}>
            {lockStatus === null ? (
              <p>Loading...</p>
            ) : lockStatus ? (
              <p>The house is locked</p>
            ) : (
              <p>The house is unlocked</p>
            )}
          </Status>
          <Button primary onClick={handleLock}>Lock</Button>
          <Button onClick={handleUnlock}>Unlock</Button>
        </TabPanel>
        <TabPanel value={value} index={1}>
          <Title>Lock History</Title>
          <LocalizationProvider dateAdapter={AdapterDateFns} locale={ja}>
            <DatePicker
              margin="normal"
              id="date-picker-dialog"
              label="Select Date"
              format="yyyy/MM/dd"
              value={selectedDate}
              onChange={handleDateChange}
              renderInput={(params) => <TextField {...params} />}
            />
          </LocalizationProvider>
          <List>
            {displayHistory.map((entry, index) => (
              <li key={index}>
                {entry.timestamp} - {entry.status ? 'Locked' : 'Unlocked'}
              </li>
            ))}
          </List>
          <IconButton onClick={clearDisplayHistory} aria-label="delete">
            <DeleteIcon />
          </IconButton>
        </TabPanel>
        <TabPanel value={value} index={2}>
          <Title>Lock Log</Title>
          <List>
            {log.map((entry, index) => (
              <li key={index}>
                {entry}
              </li>
            ))}
          </List>
        </TabPanel>
      </AppContainer>
    </>
  );
}

export default App;
