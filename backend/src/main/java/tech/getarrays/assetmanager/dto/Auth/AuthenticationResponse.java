package tech.getarrays.assetmanager.dto.Auth;

/**
 * Login/signup/refresh response. The refresh token is NOT here — it travels as the
 * HttpOnly {@link tech.getarrays.assetmanager.constants.AuthConstants#REFRESH_TOKEN_COOKIE}
 * cookie written alongside this body.
 */
public record AuthenticationResponse(String accessToken) {

}
