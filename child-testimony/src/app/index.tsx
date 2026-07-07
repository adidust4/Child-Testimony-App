import React, { useState } from 'react';
import { Text, View, StyleSheet, TextInput, Pressable, Keyboard, Platform,} from 'react-native';
import API_URL from '../utils/api';

export default function App() {


  //////////////////////////// HELPER FUNCTIONS ////////////////////////////
  
  
  const [text, setText] = useState('');
  const [prediction, setPrediction] = useState(null);


  const getPrediction = async (question) => {
    if (question.trim() === "") {
      setPrediction(null);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: question,
        }),
      });

      const data = await response.json();
      setPrediction(data);
    } catch (err) {
      console.log(err);
    }
  };
  
  

  const getStatus = () => {
  if (!prediction) {
    return {
      color: "#9ae474",
      emoji: "😁",
      question: "Type a question",
    };
  }

  switch (prediction.raw_label) {
    case "wh-question / directive":
      return {
        color: "#9ae474",
        emoji: "🙂",
        question: prediction.raw_label,
      };

    case "invitation":
      return {
        color: "#9ae474",
        emoji: "😁",
        question: prediction.raw_label,
      };

    case "tag":
      return {
        color: "#ff2400",
        emoji: "😠",
        question: prediction.raw_label,
      };

      case "option-posing":
      return {
        color: "#ff2400",
        emoji: "😠",
        question: prediction.raw_label,
      };

      case "not a question":
      return {
        color: "#e5de00",
        emoji: "😑",
        question: prediction.raw_label,
      };

    default:
      return {
        color: "#e5de00",
        emoji: "🤔",
        question: prediction.raw_label,
      };
  }
};

  const status = getStatus();

  //////////////////////////// VIEW (separated by OS) ////////////////////////////

  const content = (
    <View
      style={[
        styles.container,
        { backgroundColor: status.color },
      ]}
    >
      <Text style={styles.emoji}>{status.emoji}</Text>

      <Text style={styles.text}>
      {prediction ? prediction.raw_label : "Type a question"}
    </Text>

      <TextInput
        style={styles.textInput}
        editable
        value={text}
        onChangeText={setText}
        placeholder="Type your question here..."
        onSubmitEditing={() => getPrediction(text)}
      />
      <Pressable style={styles.button} onPress={() => getPrediction(text)}>
        <Text style={styles.buttonText}>Predict Quesiton Type</Text>
      </Pressable>
    </View>
  );

  if (Platform.OS === 'web') {
    return content;
  }

  return (
    <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
      {content}
    </Pressable>
  );
}

//////////////////////////// STYLE SHEET ////////////////////////////

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#000',
    fontSize: 40,
    margin: '2%',
  },
  textInput: {
    padding: '2%',
    borderColor: '#000',
    borderWidth: 1,
    margin: '5%',
    width: '80%',
    backgroundColor: '#fff',
    fontSize: 16,
    textAlignVertical: 'top',
  },
  emoji: {
    fontSize: 64,
    margin: '2%',
  },
  button: {
    marginTop: 20,
    backgroundColor: "#fff",
    borderColor: '#000',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
  },
});