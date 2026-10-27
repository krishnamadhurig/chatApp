import { useEffect, useState } from 'react';
import { searchUsers } from '../services/chatService';

export default function useUserSearch(term) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    const text = term.trim();
    if (!text) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await searchUsers(text);
        if (!cancelled) setResults(res.data.data.users);
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  return results;
}