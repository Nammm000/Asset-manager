package tech.getarrays.assetmanager.controllers;

import com.google.common.base.Strings;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import tech.getarrays.assetmanager.constants.AssetConstants;
import tech.getarrays.assetmanager.dto.Auth.AuthenticationDTO;
import tech.getarrays.assetmanager.dto.Auth.AuthenticationResponse;
import tech.getarrays.assetmanager.dto.Auth.LogoutResponse;
import tech.getarrays.assetmanager.dto.Auth.SignupDTO;
import tech.getarrays.assetmanager.dto.UserDTO;
import tech.getarrays.assetmanager.models.User;
import tech.getarrays.assetmanager.repo.UserRepo;
import tech.getarrays.assetmanager.services.auth.AuthService;
import tech.getarrays.assetmanager.services.jwt.UserDetailsServiceImpl;
import tech.getarrays.assetmanager.util.EmailUtil;
import tech.getarrays.assetmanager.util.AssetUtils;
import tech.getarrays.assetmanager.util.JwtUtil;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;

import java.io.IOException;
import java.util.Map;
import java.util.Objects;

@Slf4j
@RestController
@RequestMapping("/auth")
public class AuthenticationController {

    private JwtUtil jwtUtil;

    private AuthenticationManager authenticationManager;

    private UserDetailsServiceImpl userDetailsService;

    private AuthService authService;

    private EmailUtil emailUtil;

    private UserRepo userRepo;

    @Autowired
    public AuthenticationController(JwtUtil jwtUtil,
                                    AuthenticationManager authenticationManager,
                                    UserDetailsServiceImpl userDetailsService,
                                    AuthService authService, EmailUtil emailUtil,
                                    UserRepo userRepo) {
        this.jwtUtil = jwtUtil;
        this.authenticationManager = authenticationManager;
        this.userDetailsService = userDetailsService;
        this.authService = authService;
        this.emailUtil = emailUtil;
        this.userRepo = userRepo;
    }

    @PostMapping("/login")
    public AuthenticationResponse login(@RequestBody AuthenticationDTO authenticationDTO,
                                        HttpServletResponse response)
            throws BadCredentialsException, DisabledException, UsernameNotFoundException, IOException {
        log.info("Start login {}", authenticationDTO.getEmail());
        try {
            authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(authenticationDTO.getEmail(), authenticationDTO.getPassword()));
        } catch (BadCredentialsException e) {
            throw new BadCredentialsException("Incorrect username or password!");
        } catch (DisabledException disabledException) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND, "User is not activated");
            return null;
        }

        String email = authenticationDTO.getEmail();
        final UserDetails userDetails = userDetailsService.loadUserByUsername(email);
        final User.Role role = userRepo.findFirstByEmail(email).getRole();
        final String jwt = jwtUtil.generateToken(userDetails.getUsername(), role);

        return new AuthenticationResponse(jwt);
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signupUser(@RequestBody SignupDTO signupDTO) {
        log.info("Start signupUser {}", signupDTO.getEmail());
        UserDTO createdUser = authService.createUser(signupDTO);
        if (createdUser == null) {
            return new ResponseEntity<>("User not created, come again later!", HttpStatus.BAD_REQUEST);
        }
        return new ResponseEntity<>(createdUser, HttpStatus.CREATED);
    }

    @PostMapping("/logout")
    public LogoutResponse logout(@RequestBody Map<String, String> requestMap) {
        log.info("User {} logout ", requestMap.get("email"));
        SecurityContextHolder.clearContext();
        return new LogoutResponse("Logout OK");
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<String> forgotPassword(@RequestBody Map<String, String> requestMap) {
        log.info("User {} forgotPassword ", requestMap.get("email"));
        try {
            String email = requestMap.get("email");
            User user = userRepo.findFirstByEmail(email);
            if (!Objects.isNull(user) && !Strings.isNullOrEmpty(user.getEmail())) {
                emailUtil.forgetMail(email, "Credentials by Asset Management System", user.getPasswordHash());
                return AssetUtils.getResponseEntity("Check Your mail for Credentials", HttpStatus.OK);
            } else if (Objects.isNull(user)) {
                return AssetUtils.getResponseEntity("Check your mail for credentials.", HttpStatus.OK);
            }
        } catch (Exception ex) {
            ex.printStackTrace();
        }
        return AssetUtils.getResponseEntity(AssetConstants.SOMETHING_WENT_WRONG, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @PostMapping("/change-password")
    public ResponseEntity<String> changePassword(@RequestBody Map<String, String> requestMap) {
        try {
            String currentUserEmail = SecurityContextHolder.getContext().getAuthentication().getName();
            User user = userRepo.findFirstByEmail(currentUserEmail);
            if (!Objects.isNull(user)) {
                final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
                if (passwordEncoder.matches(requestMap.get("oldPassword"), user.getPasswordHash())) {
                    user.setPasswordHash(new BCryptPasswordEncoder().encode(requestMap.get("newPassword")));
                    userRepo.save(user);
                    return AssetUtils.getResponseEntity("Password Updated Successfully", HttpStatus.OK);
                }
                return AssetUtils.getResponseEntity("Incorrect Old Password", HttpStatus.BAD_REQUEST);
            }
            return AssetUtils.getResponseEntity(AssetConstants.SOMETHING_WENT_WRONG, HttpStatus.INTERNAL_SERVER_ERROR);
        } catch (Exception ex) {
            ex.printStackTrace();
        }
        return AssetUtils.getResponseEntity(AssetConstants.SOMETHING_WENT_WRONG, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @GetMapping("/hello")
    public String hello() {
        return "Hello";
    }
}
