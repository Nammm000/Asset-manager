package tech.getarrays.assetmanager.configuration;

import tech.getarrays.assetmanager.filters.JwtRequestFilter;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class WebSecurityConfiguration {

    @Autowired
    private JwtRequestFilter requestFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http.cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests((auth) -> auth
                        .requestMatchers("/auth/login", "/auth/signup", "/auth/refresh", "/auth/forgot-password", "/auth/hello").permitAll()
                        .requestMatchers("/dashboard/details",
                                "/news/getPublicNews", "/news/getAllNews",
                                "/news/getNewsById/{id}", "/news/updateViews/{id}",
                                "/plan/getAllPlanCode", "/plan/get", "/plan/getAllPlanCodeDescription").permitAll()
                        .anyRequest().authenticated()
                )
                .sessionManagement((sess) -> sess.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(requestFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    /**
     * Single source of CORS truth. The refresh token now lives in an HttpOnly cookie,
     * so credentialed cross-origin requests from the Angular dev origin need
     * Allow-Credentials with an EXACT echoed origin (never "*" with credentials).
     * Running inside the security chain also answers preflights before JwtRequestFilter.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(@Value("${app.client.url}") String clientUrls) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        // Comma-separated exact origins; tolerate a legacy trailing "/*" suffix.
        config.setAllowedOrigins(Arrays.stream(clientUrls.split(","))
                .map(String::trim)
                .map(url -> url.endsWith("/*") ? url.substring(0, url.length() - 2) : url)
                .toList());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
