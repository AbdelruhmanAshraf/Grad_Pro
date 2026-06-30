import { useState, useEffect } from 'react';
import { generateJSON } from "@/lib/gemini";

interface NameValidationAIProps {
  name: string;
  onValidation: (isValid: boolean) => void;
}

const NameValidationAI = ({ name, onValidation }: NameValidationAIProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    const validateName = async () => {
      if (!name || name.length < 2) {
        setError(null);
        onValidation(false);
        return;
      }

      // First do basic validation before calling AI
      const nameWords = name.trim().split(/\s+/);
      if (nameWords.length > 3) {
        setError("Please enter at most three names");
        onValidation(false);
        return;
      }

      // Check if it's a sentence instead of just names
      if (name.includes('.') || name.includes('!') || name.includes('?') || 
          name.toLowerCase().includes('im') || name.toLowerCase().includes("i'm") ||
          name.toLowerCase().includes('hi') || name.toLowerCase().includes('hello') ||
          name.toLowerCase().startsWith('my name') || name.toLowerCase().includes('this is')) {
        setError("Please enter only your name");
        onValidation(false);
        return;
      }

      setIsValidating(true);
      try {
        const prompt = `You are a name validation assistant. Analyze if this input "${name}" is formatted as a proper person's name.
        Rules:
        1. Must ONLY contain name(s), no sentences or phrases
        2. Maximum of three names (first, middle, last)
        3. Each name should be a proper name, not words or common nouns
        4. Should not contain greetings, introductions, or full sentences
        5. Names should follow standard capitalization

        Return ONLY a JSON object with these exact properties:
        {
          "isValid": boolean,
          "message": string (only if invalid, explaining why, max 50 chars)
        }`;

        const validation = await generateJSON<{ isValid: boolean; message?: string }>({ prompt });

        if (!validation?.isValid) {
          setError(validation?.message ?? "Invalid name");
        } else {
          setError(null);
        }
        onValidation(Boolean(validation?.isValid));
      } catch (error) {
        console.error('Error validating name:', error);
        setError(null);
        onValidation(true); // Fail open on error
      } finally {
        setIsValidating(false);
      }
    };

    // Debounce validation to avoid too many API calls
    const timeoutId = setTimeout(validateName, 500);
    return () => clearTimeout(timeoutId);
  }, [name, onValidation]);

  if (!error) return null;

  return (
    <p className="text-xs text-red-500 mt-1 ml-1">
      {error}
    </p>
  );
};

export default NameValidationAI;
