package com.dupfinder.util;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Utility class for generating file hashes.
 */
public class HashingUtility {
    
    // Constant for the hashing algorithm
    private static final String ALGORITHM = "MD5";
    // Buffer size for reading files (8KB is a good balance for most systems)
    private static final int BUFFER_SIZE = 8192;

    /**
     * Calculates the MD5 hash of a given file.
     * We use a BufferedInputStream to efficiently read the file in chunks.
     * 
     * @param filePath The path of the file to hash.
     * @return The hexadecimal string representation of the hash.
     */
    public static String generateHash(Path filePath) {
        try {
            MessageDigest digest = MessageDigest.getInstance(ALGORITHM);
            
            // Try-with-resources ensures the stream is closed automatically
            try (InputStream is = Files.newInputStream(filePath);
                 BufferedInputStream bis = new BufferedInputStream(is, BUFFER_SIZE)) {
                 
                byte[] buffer = new byte[BUFFER_SIZE];
                int bytesRead;
                
                // Read the file chunk by chunk and update the digest
                while ((bytesRead = bis.read(buffer)) != -1) {
                    digest.update(buffer, 0, bytesRead);
                }
            }
            
            // Convert the byte array to a hex string
            byte[] hashBytes = digest.digest();
            StringBuilder hexString = new StringBuilder();
            for (byte b : hashBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
            
        } catch (NoSuchAlgorithmException | IOException e) {
            // Suppress the error message for inaccessible/cloud files to avoid console spam
            // e.g., "The cloud file provider is not running" or permission denied.
            return null; // Return null if hashing fails (file is ignored)
        }
    }
}
