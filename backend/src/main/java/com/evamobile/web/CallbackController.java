package com.evamobile.web;

import com.evamobile.dto.CallbackCreateRequest;
import com.evamobile.dto.CallbackResponse;
import com.evamobile.service.CallbackService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CallbackController {

    private final CallbackService callbacks;

    public CallbackController(CallbackService callbacks) {
        this.callbacks = callbacks;
    }

    /** Public: the call-center page submits a "call me back" request. */
    @PostMapping("/api/callbacks")
    @ResponseStatus(HttpStatus.CREATED)
    public CallbackResponse create(@Valid @RequestBody CallbackCreateRequest request) {
        return callbacks.create(request);
    }
}
