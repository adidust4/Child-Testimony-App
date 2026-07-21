import React from 'react';
import { BrowserRouter, Route, Routes, Link } from 'react-router-dom';
import Page from './prediction/page';
import Home from './page';

const App = () => {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Home</Link> | <Link to="/prediction">Predict Questions</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/prediction" element={<Page />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;