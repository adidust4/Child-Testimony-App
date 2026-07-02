import { Text, View, StyleSheet, TextInput } from 'react-native';
import { useState } from 'react';

export default function App() {

  const [text, setText] = useState('');

  const getStatus = () => {
    if (text.length === 0) {
      return {
        color: '#87ae73',
        emoji: '😁',
        question: 'Invitation',
      };
    }

    if (text.length < 2) {
      return {
        color: '#87ae73',
        emoji: '🙂',
        question: 'Wh-'
      };
    }

    if (text.length < 3) {
      return {
        color: '#e5de00',
        emoji: '🤔',
        question: 'Do you know',
      };
    }

    if (text.length < 4) {
      return {
        color: '#e5de00',
        emoji: '😑',
        question: 'Non-question'
      };
    }

    if (text.length < 5) {
      return {
        color: '#e5de00',
        emoji: '🙁',
        question: 'Option-posing'
      };
    }

    return {
      color: '#ff2400',
      emoji: '😠',
      question: 'Tag'
    };
  };

  const status = getStatus();

  return (
    <View style={[styles.container, { backgroundColor: status.color }]}>

      <Text style={styles.emoji}>{status.emoji}</Text>

      <Text style={[styles.text]}>{status.question}</Text>

      <TextInput style={[styles.textInput]}
        editable
        multiline
        onChangeText={setText}
        value={text}
        placeholder='Type your question here...'
        numberOfLines={2}
      />

    </View>
  )

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#000',
    fontSize: 40,
    margin: 12,
  },
  textInput: {
    padding: 10,
    borderColor: '#000',
    borderWidth: 1,
    margin: 12,
    width: '80%',
    backgroundColor: '#fff',
    fontSize: 20,
  },
  emoji: {
    fontSize: 80,
    marginBottom: '10%',
  },
});