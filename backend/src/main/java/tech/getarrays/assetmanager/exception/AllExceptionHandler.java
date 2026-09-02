package tech.getarrays.assetmanager.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import tech.getarrays.assetmanager.dto.ErrorResponseDTO;

import java.time.LocalDateTime;
import org.springframework.web.context.request.WebRequest;

@ControllerAdvice
public class AllExceptionHandler {

    @ExceptionHandler
    public ResponseEntity<ErrorResponseDTO> handleException(UserNotFoundException exc) {
        ErrorResponseDTO error = new ErrorResponseDTO(HttpStatus.NOT_FOUND.value(),
                exc.getMessage(),
                System.currentTimeMillis());
        return new ResponseEntity<>(error, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler
    public ResponseEntity<ErrorResponseDTO> handleException(NotFoundException exc) {
        ErrorResponseDTO error = new ErrorResponseDTO(HttpStatus.NOT_FOUND.value(),
                exc.getMessage(),
                System.currentTimeMillis());
        return new ResponseEntity<>(error, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler
    public ResponseEntity<ErrorResponseDTO> handleException(AccessDeniedException exc) {
        ErrorResponseDTO error = new ErrorResponseDTO(HttpStatus.FORBIDDEN.value(),
                exc.getMessage(),
                System.currentTimeMillis());
        return new ResponseEntity<>(error, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler
    public ResponseEntity<ErrorResponseDTO> handleException(ConflictException exc) {
        ErrorResponseDTO error = new ErrorResponseDTO(HttpStatus.CONFLICT.value(),
                exc.getMessage(),
                System.currentTimeMillis());
        return new ResponseEntity<>(error, HttpStatus.CONFLICT);
    }

    // add another exception handler ... to catch any exception (catch all)
    @ExceptionHandler
    public ResponseEntity<ErrorResponseDTO> handleException(Exception exc) {

        ErrorResponseDTO error = new ErrorResponseDTO(HttpStatus.BAD_REQUEST.value(),
                exc.getMessage(),
                System.currentTimeMillis());

        // return ResponseEntity
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }
}
