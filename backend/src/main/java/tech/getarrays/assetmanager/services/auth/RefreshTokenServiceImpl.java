package tech.getarrays.assetmanager.services.auth;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tech.getarrays.assetmanager.constants.AuthConstants;
import tech.getarrays.assetmanager.exception.InvalidTokenException;
import tech.getarrays.assetmanager.models.RefreshToken;
import tech.getarrays.assetmanager.models.User;
import tech.getarrays.assetmanager.repo.RefreshTokenRepo;
import tech.getarrays.assetmanager.util.JwtUtil;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;

@Service
public class RefreshTokenServiceImpl implements RefreshTokenService {

    private final RefreshTokenRepo refreshTokenRepo;
    private final JwtUtil jwtUtil;
    private final SecureRandom secureRandom = new SecureRandom();

    public RefreshTokenServiceImpl(RefreshTokenRepo refreshTokenRepo, JwtUtil jwtUtil) {
        this.refreshTokenRepo = refreshTokenRepo;
        this.jwtUtil = jwtUtil;
    }

    @Override
    @Transactional
    public String createToken(User user) {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String token = HexFormat.of().formatHex(bytes);

        RefreshToken refreshToken = RefreshToken.builder()
                .token(token)
                .user(user)
                .expiresAt(LocalDateTime.now().plusDays(AuthConstants.REFRESH_TOKEN_EXPIRY_DAYS))
                .build();
        refreshTokenRepo.save(refreshToken);
        return token;
    }

    @Override
    @Transactional
    public TokenPair rotate(String rawToken) {
        RefreshToken refreshToken = refreshTokenRepo.findByToken(rawToken)
                .orElseThrow(() -> new InvalidTokenException("Invalid refresh token"));

        if (refreshToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            refreshTokenRepo.deleteByToken(rawToken);
            throw new InvalidTokenException("Refresh token expired");
        }

        User user = refreshToken.getUser();
        String accessToken = jwtUtil.generateToken(user.getEmail(), user.getRole());
        String newRefreshToken = createToken(user);
        refreshTokenRepo.deleteByToken(rawToken);
        return new TokenPair(accessToken, newRefreshToken);
    }

    @Override
    @Transactional
    public void revoke(String rawToken) {
        if (rawToken != null && !rawToken.isBlank()) {
            refreshTokenRepo.deleteByToken(rawToken);
        }
    }

    @Override
    @Transactional
    public void deleteAllByUserId(Long userId) {
        refreshTokenRepo.deleteAllByUserId(userId);
    }
}
