import React from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { s } from './SetupStyles';
import { B, UserIcon, CameraIcon } from './SetupIcons';

export default function PhotoPicker({ photo, setPhoto, setSelectedImageData }) {
  const pickPhotoWrapper = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const ext = result.assets[0].fileName?.split('.').pop()?.toLowerCase() || 'jpg';
      setPhoto(result.assets[0].uri);
      if (setSelectedImageData) {
        setSelectedImageData({
          uri: result.assets[0].uri,
          name: result.assets[0].fileName || `profile.${ext}`,
          type: result.assets[0].mimeType || `image/${ext}`,
          file: result.assets[0].file || null
        });
      }
    }
  };

  return (
    <View style={s.photoSection}>
      <TouchableOpacity style={s.photoCircleWrapper} onPress={pickPhotoWrapper}>
        <View style={[s.photoCircle, photo && { borderStyle: 'solid', borderColor: B.blue }]}>
          {photo ? (
            <Image source={{ uri: photo }} style={s.photoImage} />
          ) : (
            <UserIcon size={56} color={B.slate200} />
          )}
        </View>
        <View style={s.cameraBtn}>
          <CameraIcon size={20} color={B.white} />
        </View>
      </TouchableOpacity>
    </View>
  );
}
