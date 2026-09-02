package tech.getarrays.assetmanager.filters;

import io.jsonwebtoken.Claims;
import tech.getarrays.assetmanager.configuration.RequestSecurityContext;
import tech.getarrays.assetmanager.services.jwt.UserDetailsServiceImpl;
import tech.getarrays.assetmanager.util.JwtUtil;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtRequestFilter extends OncePerRequestFilter {

    private UserDetailsServiceImpl userDetailsService;

    private JwtUtil jwtUtil;

    private RequestSecurityContext requestSecurityContext;

    @Autowired
    public JwtRequestFilter(UserDetailsServiceImpl userDetailsService,
                            JwtUtil jwtUtil,
                            RequestSecurityContext requestSecurityContext) {
        this.userDetailsService = userDetailsService;
        this.jwtUtil = jwtUtil;
        this.requestSecurityContext = requestSecurityContext;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        try {
            String authHeader = request.getHeader("Authorization");
            String token = null;
            String username = null;

            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                token = authHeader.substring(7);
                username = jwtUtil.extractUsername(token);
            }

            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(username);

                if (token != null && jwtUtil.validateToken(token, userDetails)) {
                    UsernamePasswordAuthenticationToken authenticationToken =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails,
                                    null,
                                    userDetails.getAuthorities()
                            );
                    authenticationToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authenticationToken);

                    // Set request-scoped security context
                    requestSecurityContext.setUsername(username);
                    requestSecurityContext.setAuthenticated(true);
                    requestSecurityContext.setRole(
                        userDetails.getAuthorities().stream()
                            .findFirst()
                            .map(auth -> auth.getAuthority())
                            .orElse("ROLE_USER")
                    );
                }
            }

            filterChain.doFilter(request, response);
        } finally {
            // Clear request-scoped context after request completes
            // Note: Since this is request-scoped, it will be automatically cleaned up by Spring
            // but we clear it explicitly for safety
            if (requestSecurityContext != null) {
                requestSecurityContext.clear();
            }

            // Also clear SecurityContextHolder to prevent ThreadLocal leaks
            SecurityContextHolder.clearContext();
        }
    }
}
