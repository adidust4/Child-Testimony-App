import { Text, View, StyleSheet, TextInput, Pressable, Keyboard } from 'react-native';
import { useState } from 'react';
import { responsiveFont } from 'react-native-adaptive-fontsize';


export default function App() {

  const [text, setText] = useState('');

  const getStatus = () => {
    if (text.length === 0) {
      return {
        color: '#9ae474',
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
    <View style={{ flex: 1 }}>
      <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss}>
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
      </Pressable>
    </View>
  )

}

//////////////////////////////// STYLE SHEET ////////////////////////////////

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#000',
    fontSize: responsiveFont(40),
    margin: '2%',
  },
  textInput: {
    padding: '2%',
    borderColor: '#000',
    borderWidth: 1,
    margin: '5%',
    width: '80%',
    backgroundColor: '#fff',
    fontSize: responsiveFont(16),
    textAlignVertical: 'top',
  },
  emoji: {
    fontSize: responsiveFont(64),
    margin: '2%',
  },
});